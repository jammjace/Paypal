import { expect, test } from "@playwright/test";

test.beforeEach(async ({ page }) => {
  await page.goto("/pal");
  await page.getByRole("button", { name: "Start my demo" }).click();
  await expect(page.getByRole("heading", { name: "Your buckets" })).toBeVisible();
});
test("Ask Pal distinguishes budget allowance, savings and action requests", async ({ page }, info) => {
  await page.getByRole("button", { name: "How much is left in my Coffee budget?", exact: true }).click();
  await expect(page.locator(".ask-result")).toContainText("$15.40 left to spend");
  await expect(page.locator(".ask-result")).toContainText("Local fallback");
  await page.getByRole("button", { name: "How much have I saved for Travel?", exact: true }).click();
  await expect(page.locator(".ask-result")).toContainText("$420.00 saved");
  await expect(page.locator(".ask-result")).toContainText("$200.00");
  await page.getByRole("textbox", { name: "Ask Pal about your money" }).fill("Add $200 to Travel");
  await page.getByRole("button", { name: "Send question", exact: true }).click();
  await expect(page.locator(".ask-result")).toContainText("cannot change money");
  await page.getByRole("button", { name: "Compare this month", exact: true }).click();
  await expect(page.locator(".ask-result")).toContainText("$742.00 this month versus $891.00");
  expect(await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth)).toBe(false);
  await page.screenshot({ path: info.outputPath("ask-pal.png"), fullPage: true });
});
test("a spending budget tracks purchases and corrections without reserving cash", async ({ page }, info) => {
  await page.getByRole("link", { name: "Create bucket" }).click();
  await page.getByRole("combobox", { name: "Type", exact: true }).selectOption("SPENDING");
  await page.getByLabel("Bucket name", { exact: true }).fill("Eating out");
  await page.getByRole("combobox", { name: "Category", exact: true }).selectOption("Dining");
  await page.getByLabel("Budget limit (USD)").fill("100.00");
  await page.getByLabel("Budget period").selectOption("MONTHLY");
  await expect(page.getByLabel("Initial earmark (USD)")).toHaveCount(0);
  await page.getByRole("button", { name: "Create bucket", exact: true }).click();
  const budget = page.getByRole("article").filter({ has: page.getByRole("heading", { name: "Eating out", exact: true }) });
  await expect(budget).toContainText("$5.19 left to spend");
  await expect(page.getByRole("region", { name: "Your money overview" })).toContainText("$550.00");
  await page.getByRole("button", { name: "Dining", exact: true }).click();
  await expect(budget).toContainText("$66.99 over budget");
  await page.reload();
  await expect(budget).toContainText("$66.99 over budget");
  await page.getByRole("link", { name: "Eating out", exact: true }).click();
  await expect(page.getByRole("heading", { level: 1, name: "Eating out", exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "Confirm allocation" })).toHaveCount(0);
  await page.screenshot({ path: info.outputPath("spending-budget.png"), fullPage: true });
});
test("monthly saving plans persist and contributions require confirmation", async ({ page }) => {
  await page.getByRole("link", { name: "Travel", exact: true }).click();
  await page.getByLabel("Monthly contribution (USD)").fill("25.00");
  await page.getByRole("button", { name: "Save bucket", exact: true }).click();
  await expect(page.getByText("$25.00 planned per month", { exact: true })).toBeVisible();
  await page.reload();
  await expect(page.getByText("$420.00 saved", { exact: true })).toBeVisible();
  await expect(page.getByLabel("Amount (USD)", { exact: true })).toHaveValue("25.00");
  await page.getByRole("button", { name: "Confirm allocation", exact: true }).click();
  await expect(page.getByText("$445.00 saved", { exact: true })).toBeVisible();
  await page.reload();
  await expect(page.getByText("$445.00 saved", { exact: true })).toBeVisible();
});
