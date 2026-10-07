import "server-only";
import { createHash, randomBytes } from "node:crypto";
import { openDatabase } from "./database";

const hash = (token: string) => createHash("sha256").update(token).digest("hex");
export class LocalSessionStore {
  constructor(readonly filename: string) {}
  issue(userId: string): string {
    const token = randomBytes(32).toString("hex");
    const db = openDatabase(this.filename);
    try {
      db.prepare("DELETE FROM sessions WHERE expires_at < ?").run(Date.now());
      db.prepare("INSERT INTO sessions(token_hash,user_id,expires_at) VALUES(?,?,?)").run(hash(token), userId, Date.now() + 30 * 86400000);
      return token;
    } finally { db.close(); }
  }
  resolve(token: string | undefined): string | null {
    if (!token || !/^[a-f0-9]{64}$/.test(token)) return null;
    const db = openDatabase(this.filename);
    try {
      const row = db.prepare("SELECT user_id FROM sessions WHERE token_hash = ? AND expires_at > ?").get(hash(token), Date.now());
      return row ? String(row.user_id) : null;
    } finally { db.close(); }
  }
}
