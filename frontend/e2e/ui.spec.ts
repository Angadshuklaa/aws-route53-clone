import { expect, test } from "@playwright/test";

import { signIn, visible } from "./helpers";

test.describe("console shell", () => {
  test.beforeEach(async ({ page }) => signIn(page));

  test("navigation reaches every section, including placeholders", async ({ page }) => {
    const nav = page.getByRole("navigation").filter({ hasText: "Hosted zones" }).first();
    for (const [link, heading] of [
      ["Dashboard", "Dashboard"],
      ["Health checks", "Health checks"],
      ["Profiles", "Profiles"],
      ["Traffic policies", "Traffic policies"],
    ]) {
      await nav.getByRole("link", { name: link, exact: true }).click();
      await expect(page.getByRole("heading", { name: heading, level: 1 })).toBeVisible();
      await expect(visible(page, `${heading} is coming soon`)).toBeVisible();
    }
    await nav.getByText("Resolver", { exact: true }).click();
    await nav.getByRole("link", { name: "Inbound endpoints" }).click();
    await expect(page.getByRole("heading", { name: "Inbound endpoints", level: 1 })).toBeVisible();

    await page.getByRole("button", { name: "Go to Hosted zones" }).click();
    await expect(page.getByRole("heading", { name: /Hosted zones/, level: 1 })).toBeVisible();
  });

  test("top navigation search filters hosted zones", async ({ page }) => {
    await page.getByRole("searchbox", { name: "Search hosted zones" }).fill("example.org");
    await page.keyboard.press("Enter");
    await expect(page).toHaveURL(/search=example\.org/);
    await expect(page.getByRole("searchbox", { name: "Filter hosted zones" })).toHaveValue("example.org");
  });

  test("dark mode persists and keyboard shortcuts work", async ({ page }) => {
    await page.getByRole("button", { name: "Settings" }).click();
    await page.getByRole("menuitem", { name: "Dark" }).click();
    await expect(page.locator("body")).toHaveClass(/awsui-dark-mode/);
    await page.reload();
    await expect(page.locator("body")).toHaveClass(/awsui-dark-mode/);

    await page.keyboard.press("?");
    await expect(visible(page.getByRole("dialog"), "Keyboard shortcuts")).toBeVisible();
    await page.getByRole("button", { name: "Close", exact: true }).click();

    await page.keyboard.press("/");
    await expect(page.getByRole("searchbox", { name: "Filter hosted zones" })).toBeFocused();
    await page.keyboard.type("c"); // typing in the field must not trigger the shortcut
    await expect(page).toHaveURL(/\/hostedzones$/);
    await page.locator("body").click({ position: { x: 5, y: 300 } });
    await page.keyboard.press("c");
    await expect(page).toHaveURL(/\/hostedzones\/create$/);

    await page.getByRole("button", { name: "Settings" }).click();
    await page.getByRole("menuitem", { name: "Light" }).click();
    await expect(page.locator("body")).not.toHaveClass(/awsui-dark-mode/);
  });
});

test("@mobile sign-in and hosted zones are usable on a phone", async ({ page }) => {
  await signIn(page);
  await expect(page.getByRole("heading", { name: /Hosted zones/, level: 1 })).toBeVisible();
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  expect(overflow).toBeLessThanOrEqual(1);
});
