import { expect, test } from "@playwright/test";

test.beforeEach(async ({ page }) => {
  await page.goto("/login");
  await page.locator('input[type="email"]').fill("admin@shop.local");
  await page.locator('input[type="password"]').fill("admin123");
  await page.locator('button[type="submit"]').click();
  await expect(page).not.toHaveURL(/\/login$/);
});

test("critical operation pages render without a blank screen", async ({ page }) => {
  const pages = [
    ["/operation-plans", "运营计划"],
    ["/purchase-restock", "采购补货"],
    ["/orders", "订单"],
  ] as const;

  for (const [path, heading] of pages) {
    await page.goto(path);
    await expect(page.getByRole("heading", { name: heading }).first()).toBeVisible();
    await expect(page.locator("body")).not.toContainText("Application error");
  }
});

test("protected API rejects anonymous access", async ({ request }) => {
  const response = await request.get("http://127.0.0.1:8080/api/orders");
  expect(response.status()).toBe(401);
});
