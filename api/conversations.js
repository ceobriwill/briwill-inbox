import { sql, auth } from "../lib/db.js";
export default async function handler(req, res) {
  if (!auth(req, res)) return;
  const rows = await sql`select c.wa_id, c.name, c.unread, c.last_message_at,
    (select body from messages m where m.wa_id = c.wa_id order by created_at desc limit 1) as last_body
    from contacts c order by c.last_message_at desc nulls last limit 100`;
  res.json({ conversations: rows });
}
