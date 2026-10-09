import { expect, test } from "@playwright/test";

import { signIn } from "./helpers";

test.describe("public landing page", () => {
  test("shows the product page and leads into the console", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByRole("heading", { name: "Route 53 Clone - DNS service", level: 1 })).toBeVisible();
    await expect(page.getByRole("navigation", { name: "Route 53 Clone" })).toBeVisible();

    // Accordions expand and collapse.
    const benefit = page.getByRole("button", { name: /Manage public and private hosted zones/ });
    await expect(benefit).toHaveAttribute("aria-expanded", "false");
    await benefit.click();
    await expect(benefit).toHaveAttribute("aria-expanded", "true");
    await expect(page.getByText(/Every new zone starts with its NS and SOA records/)).toBeVisible();

    // The product bar links to sections on the page.
    await page.getByRole("navigation", { name: "Route 53 Clone" }).getByRole("link", { name: "FAQs" }).click();
    await expect(page).toHaveURL(/#faqs$/);

    // "Sign in to console" goes to sign-in and then to the console dashboard.
    await page.getByRole("link", { name: "Sign in to console" }).first().click();
    await expect(page).toHaveURL(/\/login\?next=%2Froute53%2Fv2%2Fdashboard/);
    await page.getByRole("button", { name: "Use demo credentials" }).first().click();
    await page.getByRole("button", { name: "Sign in", exact: true }).click();
    await expect(page.getByRole("heading", { name: "Route 53 Dashboard", level: 1 })).toBeVisible();
  });

  test("shows the signed-in state and the feedback banner works", async ({ page }) => {
    await signIn(page);
    await page.goto("/");
    await expect(page.getByRole("link", { name: "Go to the console" }).first()).toBeVisible();

    await page.getByRole("button", { name: "My account" }).first().click();
    await expect(page.getByText("Signed in as demo @ 1234-5678-9012")).toBeVisible();

    await page.getByRole("button", { name: /^Yes/ }).click();
    await expect(page.getByRole("status")).toContainText("Open the console");
  });
});

test("@mobile landing page menu works on a phone", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "Route 53 Clone - DNS service", level: 1 })).toBeVisible();
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  expect(overflow).toBeLessThanOrEqual(1);

  await page.getByRole("button", { name: "Open menu" }).click();
  await expect(page.getByRole("navigation", { name: "Mobile" })).toBeVisible();
  await page.getByRole("navigation", { name: "Mobile" }).getByRole("link", { name: "Sign in to console" }).click();
  await expect(page).toHaveURL(/\/login/);
});
