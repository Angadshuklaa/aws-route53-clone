import { expect, test } from "@playwright/test";

import { signIn, signInToHostedZones, visible } from "./helpers";

test.describe("console shell", () => {
  test.beforeEach(async ({ page }) => signInToHostedZones(page));

  test("navigation reaches every section, including placeholders", async ({ page }) => {
    const nav = page.getByRole("navigation", { name: "Side navigation" });
    await nav.getByRole("link", { name: "Dashboard", exact: true }).click();
    await expect(page.getByRole("heading", { name: "Route 53 Dashboard", level: 1 })).toBeVisible();

    for (const name of ["Health checks", "Profiles"]) {
      await nav.getByRole("link", { name, exact: true }).click();
      await expect(page.getByRole("heading", { name, level: 1 })).toBeVisible();
      await expect(visible(page, `${name} is coming soon`)).toBeVisible();
    }
    for (const [group, name] of [
      ["IP-based routing", "CIDR collections"],
      ["Traffic flow", "Traffic policies"],
      ["Domains", "Registered domains"],
      ["Resolver", "Inbound endpoints"],
      ["DNS Firewall", "Rule groups"],
    ]) {
      await nav.getByRole("button", { name: group }).click();
      await nav.getByRole("link", { name, exact: true }).click();
      await expect(page.getByRole("heading", { name, level: 1 })).toBeVisible();
      await expect(visible(page, `${name} is coming soon`)).toBeVisible();
    }

    await page.getByRole("button", { name: "Go to Hosted zones" }).click();
    await expect(page.getByRole("heading", { name: /Hosted zones/, level: 1 })).toBeVisible();
  });

  test("dashboard shows live counts", async ({ page }) => {
    const zones = await (await page.request.get("/api/hosted-zones", { params: { page_size: 1 } })).json();
    await page.goto("/route53/v2/dashboard");
    await expect(page.getByRole("link", { name: "Hosted zones" }).filter({ hasText: String(zones.total) })).toBeVisible();
    await expect(visible(page, "Recently created hosted zones")).toBeVisible();
  });

  test("top navigation search filters hosted zones", async ({ page }) => {
    await page.keyboard.press("Alt+KeyS");
    await expect(page.getByRole("searchbox", { name: "Search hosted zones" })).toBeFocused();
    await page.keyboard.type("example.org");
    await page.keyboard.press("Enter");
    await expect(page).toHaveURL(/search=example\.org/);
    await expect(page.locator("tbody tr").filter({ hasText: "example.org" }).first()).toBeVisible();
    await expect(page.locator("tbody tr").filter({ hasText: "example.com" })).toHaveCount(0);
  });

  test("header utilities: CloudShell, support menu and notifications", async ({ page }) => {
    await page.getByRole("button", { name: "CloudShell" }).first().click();
    await expect(visible(page.getByRole("dialog"), "isn't available in this Route 53 clone")).toBeVisible();
    await page.getByRole("button", { name: "Close", exact: true }).click();

    await page.getByRole("button", { name: "Support" }).click();
    await page.getByRole("menuitem", { name: "Keyboard shortcuts" }).click();
    await expect(visible(page.getByRole("dialog"), "Keyboard shortcuts")).toBeVisible();
    await page.getByRole("button", { name: "Close", exact: true }).click();

    await page.getByRole("button", { name: /^Notifications/ }).click();
    await expect(page.getByRole("menuitem", { name: /No notifications yet/ })).toBeVisible();
  });

  test("dark mode persists and keyboard shortcuts work", async ({ page }) => {
    await page.getByRole("button", { name: "Settings" }).click();
    await page.getByRole("menuitem", { name: "Dark" }).click();
    await expect(page.locator("body")).toHaveClass(/awsui-dark-mode/);
    await page.reload();
    await expect(page.locator("body")).toHaveClass(/awsui-dark-mode/);
    await expect(page.getByRole("heading", { name: /Hosted zones/, level: 1 })).toBeVisible();

    await page.keyboard.press("?");
    await expect(visible(page.getByRole("dialog"), "Keyboard shortcuts")).toBeVisible();
    await page.getByRole("button", { name: "Close", exact: true }).click();

    await page.keyboard.press("/");
    await expect(page.getByRole("combobox", { name: "Filter hosted zones" })).toBeFocused();
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
  await signIn(page, "/route53/v2/hostedzones");
  await expect(page.getByRole("heading", { name: /Hosted zones/, level: 1 })).toBeVisible();
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  expect(overflow).toBeLessThanOrEqual(1);
});
