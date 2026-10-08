import { test, expect } from "@playwright/test";

test.skip(process.env.PAL_RUN_LOCAL_AI_TESTS !== "1", "Explicit local-model evaluation only");
test("real local Qwen analyzes a subscription and a different savings decision", async ({ page }) => {
  test.setTimeout(180000);
  await page.goto("/pal");
  await page.getByRole("button", { name: "Start my demo" }).click();
  const input = page.getByRole("textbox", { name: "Ask Pal about your money" });
  await input.fill("at the rate i have been buying coffee from luckin, should i get a monthly $50 subscription instead");
  await page.getByRole("button", { name: "Send question", exact: true }).click();
  await expect(page.locator(".ask-result")).toContainText("Local AI (Qwen3 4B)", { timeout: 60000 });
  await expect(page.locator(".ask-result")).toContainText("Luckin Coffee");
  await page.getByRole("button", { name: "Assume all selected purchases are covered, with no extra charges" }).click();
  await expect(page.locator(".ask-result")).toContainText("$50.00 per full month");
  await input.fill("What if I cut Shopping spending by 20% instead?");
  await page.getByRole("button", { name: "Send question", exact: true }).click();
  await expect(page.locator(".ask-result")).toContainText("20%", { timeout: 60000 });
  await expect(page.locator(".ask-result")).toContainText("Local AI (Qwen3 4B)");
  await expect(page.locator(".ask-result")).toContainText("$58.63");
  await expect(page.getByRole("region", { name: "Your money overview" })).toContainText("$550.00");
});
test("Ask Pal uses real local Qwen3 for budget answers and a savings preview", async ({ page }, info) => {
  test.setTimeout(120000);
  await page.goto("/pal");
  await page.getByRole("button", { name: "Start my demo" }).click();
  await expect(page.getByRole("heading", { name: "Your buckets" })).toBeVisible({ timeout: 60000 });
  await page.getByRole("textbox", { name: "Ask Pal about your money" }).fill("How much can I still spend from my Coffee budget?");
  await page.getByRole("button", { name: "Send question", exact: true }).click();
  await expect(page.locator(".ask-result")).toContainText("Local AI (Qwen3 4B)", { timeout: 60000 });
  await expect(page.locator(".ask-result")).toContainText("$15.40 left to spend");
  await page.getByRole("textbox", { name: "Ask Pal about your money" }).fill("Could you set aside $200 for Travel?");
  await page.getByRole("button", { name: "Send question", exact: true }).click();
  await expect(page.locator(".ask-result")).toContainText("Local AI (Qwen3 4B)", { timeout: 100000 });
  await expect(page.getByRole("link", { name: "Review funding options" })).toBeVisible();
  await page.getByRole("link", { name: "Review funding options" }).click();
  await expect(page.getByRole("region", { name: /^Savings preview/ })).toContainText("$550.00 → $350.00");
  await expect(page.getByRole("button", { name: "Approve: Use Safe to Spend" })).toBeVisible();
  await page.screenshot({ path: info.outputPath("local-ai.png"), fullPage: true });
});

test("real local Qwen clarifies the Coffee request before approval", async ({ page }) => {
  test.setTimeout(120000);
  await page.goto("/pal");
  await page.getByRole("button", { name: "Start my demo" }).click();
  await page.getByRole("textbox", { name: "Ask Pal about your money" }).fill("i will put more money into coffee than christmas gifts. help me add $60 to coffee");
  await page.getByRole("button", { name: "Send question" }).click();
  await expect(page.locator(".ask-result")).toContainText("Local AI (Qwen3 4B)", { timeout: 60000 });
  await expect(page.locator(".ask-result")).toContainText("Clarification needed");
  await page.getByRole("button", { name: "Also withdraw from Christmas savings" }).click();
  await page.getByRole("link", { name: "Review proposed change" }).click();
  const scenario = page.getByRole("region", { name: /^What-if scenario/ });
  await expect(scenario).toContainText("$550.00 → $610.00");
  await scenario.getByRole("button", { name: "Approve and apply" }).click();
  await expect(scenario).toContainText("APPLIED");
});

test("real local Qwen routes the monthly pass question to a confirmed-scope analysis", async ({ page }) => {
  test.setTimeout(120000);
  await page.goto("/pal");
  await page.getByRole("button", { name: "Start my demo" }).click();
  await page.getByRole("textbox", { name: "Ask Pal about your money" }).fill("at the rate i am spending money on public transportation, is it better for me to get a monthly concession pass of 90 dollars instead?");
  await page.getByRole("button", { name: "Send question" }).click();
  await expect(page.locator(".ask-result")).toContainText("Local AI (Qwen3 4B)", { timeout: 60000 });
  await page.getByRole("button", { name: "Assume all selected purchases are covered, with no extra charges" }).click();
  await expect(page.locator(".ask-result")).toContainText("$177.14");
  await expect(page.locator(".ask-result")).toContainText("$87.14");
  await expect(page.getByRole("region", { name: "Your money overview" })).toContainText("$550.00");
});
