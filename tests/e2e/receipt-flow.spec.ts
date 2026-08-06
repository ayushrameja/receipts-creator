import { expect, test } from "@playwright/test";

test("edits a receipt in the drawer and restores it from background storage", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("button", { name: "Download PDF" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Share" })).toBeVisible();
  await page.getByRole("button", { name: "Open receipt controls" }).click();
  await page.getByLabel("Receipt number").fill("E2E-5321");
  await page.getByLabel("Customer name").fill("Test Customer");
  await page.getByLabel("Vehicle number").fill("PB70AB1234");
  await page.getByLabel("Quantity").first().fill("10");
  await page.getByLabel("Rate (₹)").first().fill("100");
  await page.waitForTimeout(500);
  await page.reload();
  await page.getByRole("button", { name: "Open receipt controls" }).click();
  await expect(page.getByRole("textbox", { name: "Customer name" })).toHaveValue("Test Customer");
});

test("recovers the app shell without network after first load", async ({ page, context }) => {
  await page.goto("/");
  await expect(page.getByRole("button", { name: "Download PDF" })).toBeVisible();
  await page.waitForFunction(() => navigator.serviceWorker?.ready);
  await context.setOffline(true);
  await page.reload();
  await expect(page.getByRole("button", { name: "Download PDF" })).toBeVisible();
});
