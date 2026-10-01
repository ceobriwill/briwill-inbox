import { neon } from "@neondatabase/serverless";
export const sql = neon(process.env.DATABASE_URL);
export function auth(req, res) {
  if (req.headers["x-admin-password"] !== process.env.ADMIN_PASSWORD) {
    res.status(401).json({ error: "Unauthorized" });
    return false;
  }
  return true;
}
