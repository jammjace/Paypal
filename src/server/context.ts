import "server-only";
import { cookies } from "next/headers";
import { resolve } from "node:path";
import { readConfig } from "./config";
import { SqlitePalRepository } from "@/repositories/SqlitePalRepository";
import { LocalSessionStore } from "./sessions";

export const SESSION_COOKIE = "pal_session";
export function storage() {
  const filename = resolve(readConfig().PAL_DB_PATH);
  return { repository: new SqlitePalRepository(filename), sessions: new LocalSessionStore(filename) };
}
export async function currentContext() {
  if (readConfig().FINANCIAL_PROVIDER !== "demo") return null;
  const { repository, sessions } = storage();
  const userId = sessions.resolve((await cookies()).get(SESSION_COOKIE)?.value);
  return userId ? { repository, userId } : null;
}
