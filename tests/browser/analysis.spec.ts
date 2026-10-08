import { test, expect } from "@playwright/test";

test.beforeEach(async ({ page }) => {
  await page.goto("/pal"); await page.getByRole("button", { name: "Start my demo" }).click();
  await expect(page.getByRole("heading", { name: "Your buckets" })).toBeVisible();
});
test("a subscription question stays analysis, remembers scope, and asks for terms", async ({ page }, info) => {
  await page.getByRole("textbox", { name: "Ask Pal about your money" }).fill("at the rate i have been buying coffee from luckin, should i get a monthly $50 subscription instead");
  await page.getByRole("button", { name: "Send question" }).click();
  await expect(page.locator(".ask-result")).toContainText("quota");
  await expect(page.locator(".ask-result")).not.toContainText("cannot change money");
  await page.reload();
  await expect(page.locator(".ask-result")).toContainText("Luckin Coffee");
  await page.getByRole("button", { name: "Assume all selected purchases are covered, with no extra charges" }).click();
  await expect(page.locator(".ask-result")).toContainText("$50.00 per full month");
  await expect(page.getByRole("link", { name: "Review proposed change" })).toHaveCount(0);
  await expect(page.getByRole("link", { name: "Review funding options" })).toHaveCount(0);
  await expect(page.getByRole("region", { name: "Your money overview" })).toContainText("$550.00");
  expect(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth)).toBe(false);
  await page.screenshot({ path: info.outputPath("general-analysis.png"), fullPage: true });
});
test("reductions and affordability questions stay hypothetical", async ({ page }) => {
  await page.getByRole("textbox", { name: "Ask Pal about your money" }).fill("What if I cut Shopping by 20%?");
  await page.getByRole("button", { name: "Send question" }).click();
  await expect(page.locator(".ask-result")).toContainText("$58.63");
  await expect(page.locator(".ask-result")).toContainText("hypothetical");
  await page.getByRole("button", { name: "Start a new question" }).click();
  await expect(page.locator(".ask-result")).toContainText("Analysis closed");
  await page.getByRole("textbox", { name: "Ask Pal about your money" }).fill("Can I afford another $75 monthly expense?");
  await page.getByRole("button", { name: "Send question" }).click();
  await expect(page.locator(".ask-result")).toContainText("$475.00");
  await expect(page.getByRole("region", { name: "Your money overview" })).toContainText("$550.00");
});
