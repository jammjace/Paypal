import { test, expect } from "@playwright/test";

test.skip(process.env.PAL_RUN_LOCAL_AI_TESTS !== "1", "Explicit local-model evaluation only");
test("Ask Pal uses real local Qwen3 for a budget question", async ({ page }, info) => {
  test.setTimeout(120000);
  await page.goto("/pal");
  await page.getByRole("button", { name: "Start my demo" }).click();
  await expect(page.getByRole("heading", { name: "Your buckets" })).toBeVisible({ timeout: 60000 });
  await page.getByRole("textbox", { name: "Ask Pal about your money" }).fill("How much can I still spend from my Coffee budget?");
  await page.getByRole("button", { name: "Send question", exact: true }).click();
  await expect(page.locator(".ask-result")).toContainText("Local AI (Qwen3 4B)", { timeout: 60000 });
  await expect(page.locator(".ask-result")).toContainText("$15.40 left to spend");
  await page.screenshot({ path: info.outputPath("local-ai.png"), fullPage: true });
});
