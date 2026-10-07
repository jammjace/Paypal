import { expect, test } from "@playwright/test";

test.beforeEach(async ({ page }) => {
  await page.goto("/pal");
  const start = page.getByRole("button", { name: "Start my demo", exact: true });
  await expect(start).toBeVisible();
  await start.click();
  await expect(page.getByRole("heading", { name: "Your buckets", exact: true })).toBeVisible();
});

test("dashboard renders reconciled totals without browser errors or horizontal overflow", async ({ page }, testInfo) => {
  const errors: string[] = [];
  page.on("pageerror", error => errors.push(error.message));
  await page.goto("/");
  await expect(page).toHaveURL(/\/pal$/);
  await expect(page.getByRole("heading", { level: 1, name: /pal/ })).toBeVisible();
  const overview = page.getByRole("region", { name: "Your money overview" });
  await expect(overview.getByText("$2,430.00", { exact: true })).toBeVisible();
  await expect(overview.getByText("$550.00", { exact: true })).toBeVisible();
  await expect(overview.getByText("$1,880.00", { exact: true })).toBeVisible();
  await expect(page.getByRole("heading", { name: "You’re spending 16.7% less than last month." })).toBeVisible();
  await expect(page.getByRole("button", { name: "Reimbursement", exact: true })).toBeEnabled();
  await expect(page.getByRole("link", { name: "Create bucket" })).toBeVisible();
  await expect(page.getByRole("textbox", { name: "Ask Pal about your money" })).toBeEnabled();
  await expect(page.getByRole("region", { name: "Spending Pulse" }).getByText("$742.00", { exact: true })).toBeVisible();
  await expect(page.getByRole("region", { name: "Spending Pulse" }).getByText("$891.00", { exact: true })).toBeVisible();
  await page.getByRole("link", { name: "Across 4 buckets" }).click();
  await expect(page).toHaveURL(/#buckets$/);
  await expect(page.getByRole("heading", { name: "Your buckets" })).toBeInViewport();
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth);
  expect(overflow).toBe(false);
  expect(errors).toEqual([]);
  await page.goto("/pal");
  await page.screenshot({ path: testInfo.outputPath("dashboard.png"), fullPage: true });
});

test("keyboard skip link reaches the dashboard", async ({ page }) => {
  await page.goto("/pal");
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  await page.keyboard.press("Tab");
  await expect(page.getByRole("link", { name: "Skip to dashboard" })).toBeFocused();
  await page.keyboard.press("Enter");
  await expect(page).toHaveURL(/#main$/);
});

test("merchant details and income breakdown expose deterministic analytics", async ({ page }, testInfo) => {
  await page.goto("/pal");
  await expect(page.getByRole("heading", { name: "Spending Pulse" })).toBeVisible();
  await expect(page.getByRole("region", { name: "Spending Pulse" }).getByRole("list").getByText("Dining", { exact: true })).toBeVisible();
  await page.getByText("Luckin Coffee", { exact: true }).click();
  const details = page.getByRole("region", { name: "Luckin Coffee analytics" });
  await expect(details.getByText("$7.05", { exact: true })).toBeVisible();
  await expect(details.getByText("$61.20", { exact: true })).toBeVisible();
  await expect(details.getByText("+38.2%", { exact: true })).toBeVisible();
  await expect(details.getByText("100% of Coffee spending · $84.60", { exact: true })).toBeVisible();
  await page.getByText("Income and money received", { exact: true }).click();
  const income = page.getByRole("region", { name: "Income breakdown" });
  await expect(income.getByText("$32.00", { exact: true })).toBeVisible();
  await expect(income.getByText("$48.20", { exact: true })).toBeVisible();
  await expect(income.getByText("$2,400.00", { exact: true })).toHaveCount(2);
  await expect(income.getByText("$200.00", { exact: true })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth)).toBe(false);
  await page.screenshot({ path: testInfo.outputPath("expanded-analytics.png"), fullPage: true });
  const summary = page.getByLabel("Details for Luckin Coffee", { exact: true });
  await summary.focus();
  await page.keyboard.press("Enter");
  await expect(details).toBeHidden();
});
