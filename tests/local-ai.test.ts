import { describe, it, expect } from "vitest";
import { createDemoFixture } from "@/fixtures/demo";
import { workspaceFromSnapshot } from "@/domain/workspace";
import { askPal, classifyTransaction } from "@/server/ai/pal";
import { OllamaInterpreter } from "@/server/ai/structured";

// Explicit opt-in only. Ordinary tests never require a downloaded model.
describe.skipIf(process.env.PAL_RUN_LOCAL_AI_TESTS !== "1")("live local Qwen3 4B", () => {
  const state = workspaceFromSnapshot(createDemoFixture({ userId: "local-eval", accountId: "sample", connectionId: "sample" }, "2026-10-15T18:00:00.000Z"));
  const interpreter = new OllamaInterpreter();
  it.each([
    ["How much can I still spend from my Coffee budget?", "$15.40 left to spend"],
    ["What have I put away for Travel, and what is my monthly contribution plan?", "$420.00 saved"],
    ["Compare this month's spending with the same days last month", "$742.00 this month versus $891.00"],
    ["How much did I spend at Luckin Coffee this month?", "$84.60 across 12"],
    ["Why is my Safe to Spend different from my total balance?", "$550.00 Safe to Spend"],
    ["Move $200 into Travel", "cannot change money"],
    ["Predict tomorrow's stock market", "Please ask one"],
  ])("interprets: %s", async (question, expected) => {
    const before = structuredClone(state);
    const result = await askPal(state, question, interpreter);
    expect(result.mode, result.notice).toBe("Local AI (Qwen3 4B)");
    expect(result.answer).toContain(expected);
    expect(state).toEqual(before);
  }, 60000);
  it("classifies a clear merchant without inventing payment purpose", async () => {
    const example = state.transactions.find(t => t.category === "Coffee")!;
    const result = await classifyTransaction({ ...example, category: "Uncategorized", categorizationSource: "UNCLASSIFIED", categorizationConfidence: 0, needsReview: true }, [], interpreter);
    expect(result.categorizationSource).toBe("AI");
    expect(result.category).toBe("Coffee");
    const alex = state.transactions.find(t => t.normalizedMerchant === "Alex")!;
    expect((await classifyTransaction(alex, [], interpreter)).needsReview).toBe(true);
  }, 60000);
});
