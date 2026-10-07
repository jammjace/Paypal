import { test, expect } from "@playwright/test";

test.beforeEach(async ({ page }) => {
  await page.goto("/pal");
  await page.getByRole("button", { name: "Start my demo" }).click();
  await expect(page.getByRole("heading", { name: "Your buckets" })).toBeVisible();
});

test("Quick Check persists through reload and sync, and updates income and activity", async ({ page }, testInfo) => {
  await page.getByRole("checkbox", { name: "Remember Alex for similar future transactions" }).check();
  await page.getByRole("button", { name: "Reimbursement", exact: true }).click();
  await expect(page.getByRole("button", { name: "Reimbursement", exact: true })).toHaveCount(0);
  await page.reload();
  await expect(page.getByRole("button", { name: "Reimbursement", exact: true })).toHaveCount(0);
  await page.getByText("Income and money received", { exact: true }).click();
  await expect(page.getByRole("region", { name: "Income breakdown" }).getByText("$80.20", { exact: true })).toBeVisible();
  await page.getByRole("link", { name: "Transactions", exact: true }).click();
  const alex = page.getByRole("article").filter({ hasText: "Alex" });
  await expect(alex.locator(".transaction-category")).toHaveText("Reimbursement");
  await page.getByRole("button", { name: "Sync transactions", exact: true }).click();
  await expect(page.getByRole("status")).toContainText("Transactions synced");
  await expect(alex.locator(".transaction-category")).toHaveText("Reimbursement");
  await page.getByRole("link", { name: "Pal activity", exact: true }).click();
  await expect(page.getByText("Alex categorized as Reimbursement", { exact: true })).toBeVisible();
  await page.screenshot({ path: testInfo.outputPath("saved-activity.png"), fullPage: true });
  await page.getByRole("link", { name: "Pal dashboard", exact: true }).click();
  await page.getByText("Demo controls", { exact: true }).click();
  await page.getByRole("button", { name: "Confirm reset" }).click();
  await expect(page.getByRole("button", { name: "Reimbursement", exact: true })).toBeVisible();
});

test("bucket CRUD and confirmed earmarks persist, then archive releases the balance", async ({ page }, testInfo) => {
  await page.getByRole("link", { name: "Create bucket" }).click();
  await page.getByLabel("Bucket name", { exact: true }).fill("Emergency");
  await page.getByLabel("Category", { exact: true }).fill("Savings");
  await page.getByLabel("Target amount (USD)").fill("500.00");
  await page.getByLabel("Initial earmark (USD)").fill("50.00");
  await page.getByRole("button", { name: "Create bucket", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Emergency", exact: true })).toBeVisible();
  await expect(page.getByRole("region", { name: "Your money overview" }).getByText("$500.00", { exact: true })).toBeVisible();
  await page.getByRole("link", { name: "Emergency", exact: true }).click();
  await page.getByLabel("Bucket name", { exact: true }).fill("Rainy day");
  await page.getByRole("button", { name: "Save bucket", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Rainy day", exact: true })).toBeVisible();
  await page.getByLabel("Amount (USD)", { exact: true }).fill("25.00");
  await expect(page.getByText("Safe to Spend: $475.00", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Confirm allocation" }).click();
  await expect(page.getByText("$75.00 saved", { exact: true })).toBeVisible();
  await page.reload();
  await expect(page.getByText("$75.00 saved", { exact: true })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth)).toBe(false);
  await page.screenshot({ path: testInfo.outputPath("bucket-editor.png"), fullPage: true });
  await page.getByText("Archive bucket", { exact: true }).click();
  await page.getByRole("button", { name: "Confirm archive" }).click();
  await expect(page.getByRole("heading", { name: "Your buckets" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Rainy day", exact: true })).toHaveCount(0);
  await expect(page.getByRole("region", { name: "Your money overview" }).getByText("$550.00", { exact: true })).toBeVisible();
});

test("a second browser cannot read the first browser's private bucket", async ({ page, browser, baseURL }) => {
  await page.getByRole("link", { name: "Create bucket" }).click();
  await page.getByLabel("Bucket name", { exact: true }).fill("Private goal");
  await page.getByLabel("Category", { exact: true }).fill("Travel");
  await page.getByRole("button", { name: "Create bucket", exact: true }).click();
  await page.getByRole("link", { name: "Private goal", exact: true }).click();
  await expect(page).toHaveURL(/\/pal\/buckets\/[a-f0-9-]+$/);
  const privateUrl = page.url();
  const context = await browser.newContext({ baseURL });
  try {
    const other = await context.newPage();
    await other.goto("/pal");
    await other.getByRole("button", { name: "Start my demo" }).click();
    await expect(other.getByRole("heading", { name: "Your buckets" })).toBeVisible();
    await expect(other.getByRole("link", { name: "Private goal", exact: true })).toHaveCount(0);
    await other.goto(privateUrl);
    await expect(other.getByRole("heading", { name: "404", exact: true })).toBeVisible();
    await expect(other.getByRole("heading", { name: "Private goal", exact: true })).toHaveCount(0);
  } finally { await context.close(); }
});
