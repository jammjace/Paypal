import { describe, expect, it, vi } from "vitest";
import { z } from "zod";
import { createDemoFixture } from "@/fixtures/demo";
import { workspaceFromSnapshot } from "@/domain/workspace";
import { answerQuery, parseLocalQuery, queryContext, querySchema } from "@/services/query";
import { askPal, classifyTransaction } from "@/server/ai/pal";
import { OllamaInterpreter, type StructuredInterpreter } from "@/server/ai/structured";

const state = workspaceFromSnapshot(createDemoFixture({ userId: "u", accountId: "a", connectionId: "c" }, "2026-10-15T18:00:00.000Z"));
const fake = (value: unknown): StructuredInterpreter => ({ generate: async <T>(schema: z.ZodType<T>) => schema.parse(value) });
describe("Ask Pal deterministic answers", () => {
  it.each([
    ["Compare this month", "$742.00 this month versus $891.00"],
    ["How much is left in my Coffee budget?", "$15.40 left to spend"],
    ["How much have I saved for Travel?", "$420.00 saved toward $1,000.00"],
    ["How much did I spend at Luckin this month?", "$84.60 across 12"],
    ["How much did I spend on SHEIN last month?", "$193.40"],
    ["Where did I spend most?", "Whole Foods"],
    ["Why is my Safe to Spend low?", "$550.00 Safe to Spend"],
    ["Show my income", "$32.00 reimbursements"],
    ["How much did I spend eating out?", "$94.81"],
    ["Add $200 to Travel", "cannot change money"],
    ["Will I be rich next year?", "Please ask one"],
  ])("answers %s", (q, expected) => {
    const before = structuredClone(state);
    expect(answerQuery(state, parseLocalQuery(q, queryContext(state)))).toContain(expected);
    expect(state).toEqual(before);
  });
  it("rejects foreign entity names and extra model fields", () => {
    expect(answerQuery(state, { intent: "BUCKET", entity: "someone else's bucket", period: "MONTH_TO_DATE" })).toContain("active buckets");
    expect(() => answerQuery(state, { intent: "BALANCE", entity: null, period: "MONTH_TO_DATE", amount: 999 })).toThrow();
  });
  it("labels absent local runtime, invalid responses and successful interpretation accurately", async () => {
    expect((await askPal(state, "Compare this month", null)).mode).toBe("Local fallback");
    const invalid = await askPal(state, "Compare this month", fake({ intent: "TRANSFER_ALL" }));
    expect(invalid.notice).toContain("invalid");
    expect(invalid.answer).toContain("$742.00");
    const valid = await askPal(state, "my travel savings?", fake({ intent: "BUCKET", entity: "Travel", period: "MONTH_TO_DATE" }));
    expect(valid.mode).toBe("Local AI (Qwen3 4B)");
    expect(valid.answer).toContain("$420.00");
  });
});
describe("structured transport", () => {
  const payload = (text: string) => ({ done: true, done_reason: "stop", message: { content: text } });
  it("uses only a fixed local model and loopback endpoint without credentials", async () => {
    const query = { intent: "BALANCE", entity: null, period: "MONTH_TO_DATE" };
    const request = vi.fn<typeof fetch>().mockResolvedValue(new Response(JSON.stringify(payload(JSON.stringify(query)))));
    const result = await new OllamaInterpreter(request).generate(querySchema, "Interpret", { question: "balance" });
    expect(result).toEqual(query);
    const body = JSON.parse(String(request.mock.calls[0][1]?.body));
    expect(body).toMatchObject({ model: "qwen3:4b", stream: false, think: false, format: { additionalProperties: false } });
    expect(request.mock.calls[0][0]).toBe("http://127.0.0.1:11434/api/chat");
    expect(request.mock.calls[0][1]).toMatchObject({ redirect: "error", headers: { "Content-Type": "application/json" } });
    expect(request.mock.calls[0][1]?.headers).not.toHaveProperty("Authorization");
    expect(body.tools).toBeUndefined();
  });
  it.each([
    payload("not json"), payload('{"intent":"BALANCE"}'),
    { done: false, message: { content: "{}" } },
    { done: true, done_reason: "length", message: { content: "{}" } },
  ])("rejects malformed/incomplete/refused output", async body => {
    const request = vi.fn<typeof fetch>().mockResolvedValue(new Response(JSON.stringify(body)));
    await expect(new OllamaInterpreter(request).generate(querySchema, "Interpret", {})).rejects.toThrow();
  });
  it("handles HTTP failures without exposing upstream details", async () => {
    const request = vi.fn<typeof fetch>().mockResolvedValue(new Response("private error", { status: 401 }));
    await expect(new OllamaInterpreter(request).generate(querySchema, "Interpret", {})).rejects.toThrow("unavailable");
  });
});
describe("classification", () => {
  const tx = state.transactions.find(t => t.normalizedMerchant === "Target" && t.needsReview)!;
  it.each([[0.95, false], [0.7, false], [0.4, true]])("routes confidence %s", async (confidence, review) => {
    const result = await classifyTransaction(tx, [], fake({ category: "Shopping", normalizedMerchant: "Target", confidence }));
    expect(result).toMatchObject({ categorizationSource: "AI", needsReview: review, categorizationConfidence: confidence });
  });
  it("preserves corrections and peer ambiguity, rejects invalid categories and malformed AI", async () => {
    const ai = fake({ category: "Income", normalizedMerchant: "Target", confidence: 1 });
    expect(await classifyTransaction({ ...tx, categorizationSource: "USER" }, [], ai)).toEqual({ ...tx, categorizationSource: "USER" });
    const alex = state.transactions.find(t => t.normalizedMerchant === "Alex")!;
    expect((await classifyTransaction(alex, [], ai)).needsReview).toBe(true);
    expect((await classifyTransaction(tx, [], ai)).category).toBe("Uncategorized");
    expect((await classifyTransaction(tx, [], fake({ confidence: 10 }))).needsReview).toBe(true);
  });
});
