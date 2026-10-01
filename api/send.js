import { sql, auth } from "../lib/db.js";
export default async function handler(req, res) {
  if (!auth(req, res)) return;
  if (req.method !== "POST") return res.status(405).end();
  const { to, text } = req.body || {};
  if (!to || !text?.trim()) return res.status(400).json({ error: "to and text required" });

  const [c] = await sql`select last_inbound_at from contacts where wa_id = ${to}`;
  if (!c?.last_inbound_at || Date.now() - new Date(c.last_inbound_at) > 24 * 3600 * 1000) {
    return res.status(400).json({ error: "24-hour window closed. Only approved templates can be sent." });
  }
  const r = await fetch(`https://graph.facebook.com/v26.0/${process.env.WHATSAPP_PHONE_NUMBER_ID}/messages`, {
    method: "POST",
    headers: { Authorization: `Bearer ${process.env.WHATSAPP_TOKEN}`, "Content-Type": "application/json" },
    body: JSON.stringify({ messaging_product: "whatsapp", to, type: "text", text: { body: text } }),
  });
  const j = await r.json();
  if (!r.ok) return res.status(502).json({ error: j.error?.message || "WhatsApp error" });
  await sql`insert into messages (id, wa_id, direction, body, status) values (${j.messages[0].id}, ${to}, 'out', ${text}, 'sent') on conflict (id) do nothing`;
  await sql`update contacts set last_message_at = now() where wa_id = ${to}`;
  res.json({ ok: true });
}
