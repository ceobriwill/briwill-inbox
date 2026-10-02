import crypto from "crypto";
import { makeToken } from "../lib/db.js";

const h = (s) => crypto.createHash("sha256").update(String(s)).digest();

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).end();
  const { password } = req.body || {};
  const real = process.env.ADMIN_PASSWORD;
  if (!real || !crypto.timingSafeEqual(h(password), h(real))) {
    await new Promise((r) => setTimeout(r, 1000)); // slow down guessing
    return res.status(401).json({ error: "Wrong password" });
  }
  res.json({ token: makeToken() });
}
