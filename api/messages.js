import { sql, auth } from "../lib/db.js";
export default async function handler(req, res) {
  if (!auth(req, res)) return;
  const { wa_id } = req.query;
  if (!wa_id) return res.status(400).json({ error: "wa_id required" });
  await sql`update contacts set unread = 0 where wa_id = ${wa_id}`;
  const messages = await sql`select id, direction, body, status, error, created_at
    from messages where wa_id = ${wa_id} order by created_at asc limit 500`;
  const [c] = await sql`select last_inbound_at from contacts where wa_id = ${wa_id}`;
  res.json({ messages, last_inbound_at: c?.last_inbound_at || null });
}
