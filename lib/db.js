import { neon } from "@neondatabase/serverless";
import crypto from "crypto";
export const sql = neon(process.env.DATABASE_URL);

// Signed session tokens (HMAC). Hard expiry; idle timeout is enforced in the browser.
export const SESSION_MS = 12 * 3600 * 1000;
const key = () => process.env.SESSION_SECRET || process.env.ADMIN_PASSWORD;
const mac = (data) => crypto.createHmac("sha256", key()).update(data).digest("base64url");

export function makeToken() {
  const p = Buffer.from(JSON.stringify({ exp: Date.now() + SESSION_MS })).toString("base64url");
  return `${p}.${mac(p)}`;
}
function validToken(t) {
  const [p, s] = (t || "").split(".");
  if (!p || !s) return false;
  const e = mac(p);
  if (s.length !== e.length || !crypto.timingSafeEqual(Buffer.from(s), Buffer.from(e))) return false;
  try { return JSON.parse(Buffer.from(p, "base64url").toString()).exp > Date.now(); } catch { return false; }
}
export function auth(req, res) {
  const t = (req.headers.authorization || "").replace(/^Bearer /, "");
  if (!key() || !validToken(t)) {
    res.status(401).json({ error: "Unauthorized" });
    return false;
  }
  return true;
}
