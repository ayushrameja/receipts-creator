import { expect, test } from "@playwright/test";

test("creates, saves, searches, and reopens a receipt", async ({ page }) => {
  await page.goto("/");
  await page.getByLabel("Receipt number").fill("E2E-5321");
  await page.getByLabel("Customer name").fill("Test Customer");
  await page.getByLabel("Vehicle number").fill("PB70AB1234");
  await page.getByLabel("Quantity").fill("10");
  await page.getByLabel("Rate (₹)").fill("100");
  await page.getByRole("button", { name: "Save receipt" }).click();
  await expect(page.getByText("Receipt saved on this device.")).toBeVisible();
  await page.getByRole("button", { name: /History/ }).click();
  await page.getByLabel("Search receipt history").fill("PB70");
  await expect(page.getByText("Receipt E2E-5321")).toBeVisible();
  await page.getByRole("button", { name: "Open" }).click();
  await expect(page.getByRole("textbox", { name: "Customer name" })).toHaveValue("Test Customer");
});

test("recovers the app shell without network after first load", async ({ page, context }) => {
  await page.goto("/");
  await expect(page.getByText("Create a receipt")).toBeVisible();
  await page.waitForFunction(() => navigator.serviceWorker?.ready);
  await context.setOffline(true);
  await page.reload();
  await expect(page.getByText("Create a receipt")).toBeVisible();
});
