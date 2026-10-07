"use server";

import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { CommandError, executeCommand } from "@/services/commands";
import { currentContext, SESSION_COOKIE } from "./context";
import { createDemoSession, resetDemo, syncWorkspace } from "./demo";
import { askPal, configuredInterpreter } from "./ai/pal";
import { readConfig } from "./config";

export type ActionResult = { ok: boolean; message: string };
export async function startDemoAction() {
  const existing = await currentContext();
  if (!existing) {
    const token = await createDemoSession();
    (await cookies()).set(SESSION_COOKIE, token, { httpOnly: true, sameSite: "lax", secure: readConfig().PAL_COOKIE_SECURE === "true", path: "/", maxAge: 30 * 86400 });
  }
  redirect("/pal");
}
export async function mutateAction(input: unknown): Promise<ActionResult> {
  const context = await currentContext();
  if (!context) return { ok: false, message: "Your demo session expired. Open Pal again to start a session." };
  try {
    const message = await executeCommand(context.repository, context.userId, input);
    revalidatePath("/pal", "layout");
    return { ok: true, message };
  } catch (error) {
    return { ok: false, message: error instanceof CommandError ? error.message : error instanceof z.ZodError ? "Check the required fields, dates and amounts." : "Unable to save. Check the amount, then refresh and try again." };
  }
}
export async function syncAction(): Promise<ActionResult> {
  const context = await currentContext();
  if (!context) return { ok: false, message: "Your session expired." };
  try {
    await syncWorkspace(context.repository, context.userId);
    revalidatePath("/pal", "layout");
    return { ok: true, message: "Transactions synced. Your classifications and buckets were preserved." };
  } catch { return { ok: false, message: "Sync failed. Your saved money picture has been preserved." }; }
}
export async function resetDemoAction() {
  const context = await currentContext();
  if (!context) redirect("/pal");
  await resetDemo(context.repository, context.userId);
  revalidatePath("/pal", "layout");
  redirect("/pal");
}

export async function askPalAction(input: unknown) {
  const question = z.string().trim().min(1).max(500).parse(input);
  const context = await currentContext();
  if (!context) throw new Error("Session expired. Refresh Pal.");
  const state = await context.repository.read(context.userId);
  const result = await askPal(state, question, configuredInterpreter());
  return result;
}
