import { expect, test } from "@playwright/test";

test("keeps separate Evergreen and SKN drafts across switching and reload", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("button", { name: "Download PDF" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Save receipt" })).toHaveCount(0);
  await page.getByRole("button", { name: "Open receipt controls" }).click();
  const drawer = page.getByRole("complementary", { name: "Receipt controls" });
  await expect(drawer.getByText("Receipts", { exact: true })).toBeVisible();
  await expect(drawer.getByRole("button", { name: "Save receipt" })).toBeVisible();
  await drawer.getByLabel("Receipt number").fill("E2E-EVERGREEN");
  await drawer.getByLabel("Customer name").fill("Test Customer");
  await drawer.getByLabel("Quantity").first().fill("10");
  await drawer.getByLabel("Rate (₹)").first().fill("100");
  await drawer.getByRole("button", { name: "Use SKN receipt template" }).click();
  await drawer.getByLabel("Receipt number").fill("E2E-SKN");
  await drawer.getByLabel("Amount (₹)", { exact: true }).fill("595");
  await drawer.getByRole("button", { name: "Use Evergreen receipt template" }).click();
  await expect(drawer.getByLabel("Customer name")).toHaveValue("Test Customer");
  await page.waitForTimeout(500);
  await page.reload();
  await page.getByRole("button", { name: "Open receipt controls" }).click();
  const restoredDrawer = page.getByRole("complementary", { name: "Receipt controls" });
  await expect(restoredDrawer.getByLabel("Customer name")).toHaveValue("Test Customer");
  await restoredDrawer.getByRole("button", { name: "Use SKN receipt template" }).click();
  await expect(restoredDrawer.getByLabel("Receipt number")).toHaveValue("E2E-SKN");
});

test("saves an SKN receipt into shared history and requires a revision note", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Use SKN receipt template" }).click();
  await page.getByRole("button", { name: "Open receipt controls" }).click();
  const drawer = page.getByRole("complementary", { name: "Receipt controls" });
  await drawer.getByLabel("Receipt number").fill("E2E-8326");
  await drawer.getByLabel("Date").fill("2026-08-02");
  await drawer.getByLabel("Vehicle number").fill("RJ02AB2585");
  await drawer.getByLabel("Quantity").fill("6.78");
  await drawer.getByLabel("Amount (₹)", { exact: true }).fill("595");
  await drawer.getByRole("button", { name: "Save receipt" }).click();
  await expect(page.getByRole("status")).toContainText("Receipt saved");
  await drawer.getByRole("button", { name: /History/ }).click();
  await expect(drawer.getByText("Receipt E2E-8326")).toBeVisible();
  await drawer.getByRole("button", { name: "Open skn receipt E2E-8326" }).click();
  await page.getByRole("button", { name: "Open receipt controls" }).click();
  const editDrawer = page.getByRole("complementary", { name: "Receipt controls" });
  await editDrawer.getByLabel("Amount (₹)", { exact: true }).fill("600");
  await editDrawer.getByRole("button", { name: "Save revision" }).click();
  const dialog = page.getByRole("dialog", { name: "Why is this receipt changing?" });
  await dialog.getByLabel("Revision note").fill("Corrected amount");
  await dialog.getByRole("button", { name: "Save revision" }).click();
  await expect(page.getByRole("status")).toContainText("Revision saved");
});

test("recovers the app shell without network after first load", async ({ page, context }) => {
  await page.goto("/");
  await expect(page.getByRole("button", { name: "Download PDF" })).toBeVisible();
  await page.waitForFunction(() => navigator.serviceWorker?.ready);
  await context.setOffline(true);
  await page.reload();
  await expect(page.getByRole("button", { name: "Download PDF" })).toBeVisible();
});
