import crypto from "crypto";
import { sql } from "../lib/db.js";
export const config = { api: { bodyParser: false } };

async function raw(req) {
  const chunks = [];
  for await (const c of req) chunks.push(c);
  return Buffer.concat(chunks);
}

export default async function handler(req, res) {
  if (req.method === "GET") {
    const { "hub.mode": mode, "hub.verify_token": token, "hub.challenge": challenge } = req.query;
    return mode === "subscribe" && token === process.env.WEBHOOK_VERIFY_TOKEN
      ? res.status(200).send(challenge)
      : res.status(403).send("Forbidden");
  }
  if (req.method !== "POST") return res.status(405).end();

  const body = await raw(req);
  const sig = req.headers["x-hub-signature-256"] || "";
  const expected = "sha256=" + crypto.createHmac("sha256", process.env.APP_SECRET).update(body).digest("hex");
  if (sig.length !== expected.length || !crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expected))) {
    return res.status(401).send("Bad signature");
  }

  try {
    const data = JSON.parse(body.toString());
    for (const entry of data.entry || []) {
      for (const change of entry.changes || []) {
        const v = change.value || {};
        for (const m of v.messages || []) {
          const name = v.contacts?.find((c) => c.wa_id === m.from)?.profile?.name || null;
          const text = m.type === "text" ? m.text.body : `[${m.type}]`;
          const ts = new Date(Number(m.timestamp) * 1000).toISOString();
          const ins = await sql`insert into messages (id, wa_id, direction, body, status, created_at)
            values (${m.id}, ${m.from}, 'in', ${text}, 'received', ${ts}) on conflict (id) do nothing returning id`;
          if (ins.length) {
            await sql`insert into contacts (wa_id, name, unread, last_message_at, last_inbound_at)
              values (${m.from}, ${name}, 1, ${ts}, ${ts})
              on conflict (wa_id) do update set name = coalesce(${name}, contacts.name),
              unread = contacts.unread + 1, last_message_at = ${ts}, last_inbound_at = ${ts}`;
          }
        }
        for (const s of v.statuses || []) {
          const err = s.errors?.[0];
          const ts = new Date(Number(s.timestamp) * 1000).toISOString();
          await sql`insert into contacts (wa_id, last_message_at) values (${s.recipient_id}, ${ts}) on conflict (wa_id) do nothing`;
          await sql`insert into messages (id, wa_id, direction, body, status, error, created_at)
            values (${s.id}, ${s.recipient_id}, 'out', '[template message]', ${s.status},
            ${err ? `${err.code}: ${err.title}` : null}, ${ts})
            on conflict (id) do update set status = excluded.status, error = excluded.error`;
        }
      }
    }
    return res.status(200).send("OK");
  } catch (e) {
    console.error("Webhook error:", e);
    return res.status(500).send("Error");
  }
}
