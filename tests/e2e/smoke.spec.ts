import { expect, test } from "@playwright/test";

test.describe("DMProperties AI smoke", () => {
  test("homepage shows conversational hero", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByText("DMProperties AI").first()).toBeVisible();
    await expect(
      page.getByPlaceholder("Tell me what you're looking for..."),
    ).toBeVisible();
  });

  test("search page loads dual view", async ({ page }) => {
    await page.goto("/search?q=waterfront%20villas%20under%20AED%2030M");
    await expect(page.getByText("AI Assistant")).toBeVisible();
    await expect(page.getByRole("heading", { name: "Results" })).toBeVisible();
  });

  test("login page offers Google and OTP", async ({ page }) => {
    await page.goto("/login");
    await expect(page.getByText("Continue with Google")).toBeVisible();
    await expect(page.getByPlaceholder("+971 50 000 0000")).toBeVisible();
  });
});
