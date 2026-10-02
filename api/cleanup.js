import { sql } from "../lib/db.js";

// Runs daily via Vercel Cron (see vercel.json). Deletes old messages and empty contacts.
export default async function handler(req, res) {
  if (!process.env.CRON_SECRET)
    return res.status(500).json({ error: "CRON_SECRET not set" });
  if (req.headers.authorization !== `Bearer ${process.env.CRON_SECRET}`) {
    return res.status(401).json({ error: "Unauthorized" });
  }
  const days = Number(process.env.RETENTION_DAYS) || 90;
  const m =
    await sql`delete from messages where created_at < now() - make_interval(days => ${days}::int) returning id`;
  const c =
    await sql`delete from contacts c where not exists (select 1 from messages m where m.wa_id = c.wa_id) returning wa_id`;
  res.json({
    retentionDays: days,
    deletedMessages: m.length,
    deletedContacts: c.length,
  });
}
