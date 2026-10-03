import { expect, test } from "@playwright/test";

test("read-only dashboard renders reconciled totals without browser errors or horizontal overflow", async ({ page }, testInfo) => {
  const errors: string[] = [];
  page.on("pageerror", error => errors.push(error.message));
  await page.goto("/");
  await expect(page).toHaveURL(/\/pal$/);
  await expect(page.getByRole("heading", { level: 1, name: /pal/ })).toBeVisible();
  const overview = page.getByRole("region", { name: "Your money overview" });
  await expect(overview.getByText("$2,430.00", { exact: true })).toBeVisible();
  await expect(overview.getByText("$486.00", { exact: true })).toBeVisible();
  await expect(overview.getByText("$1,944.00", { exact: true })).toBeVisible();
  await expect(page.getByRole("heading", { name: "You’re spending 16.7% less than last month." })).toBeVisible();
  await expect(page.getByRole("button", { name: "Reimbursement", exact: true })).toBeDisabled();
  await expect(page.getByRole("button", { name: "Create bucket" })).toBeDisabled();
  await expect(page.getByRole("textbox", { name: "Ask Pal about your money" })).toBeDisabled();
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
