import { expect, test } from "@playwright/test";

import { DEMO, signIn, visible } from "./helpers";

test.describe("authentication", () => {
  test("protected pages redirect to sign-in and return afterwards", async ({ page }) => {
    await page.goto("/route53/v2/healthchecks");
    await expect(page).toHaveURL(/\/login\?next=%2Froute53%2Fv2%2Fhealthchecks/);
    await expect(page.getByRole("heading", { name: "Sign In", level: 1 })).toBeVisible();

    await page.getByRole("button", { name: "Use demo credentials" }).first().click();
    await expect(page.getByRole("heading", { name: "Sign in as IAM user", level: 1 })).toBeVisible();
    await page.getByRole("button", { name: "Sign in", exact: true }).click();
    await expect(page).toHaveURL(/\/route53\/v2\/healthchecks$/);
    await expect(page.getByRole("heading", { name: "Health checks", level: 1 })).toBeVisible();
  });

  test("signing in lands on the Route 53 dashboard", async ({ page }) => {
    await signIn(page);
    await expect(page.getByRole("heading", { name: "Route 53 Dashboard", level: 1 })).toBeVisible();
    await expect(visible(page, "Service overview")).toBeVisible();
  });

  test("wrong credentials show an error and no session is created", async ({ page }) => {
    await page.goto("/login");
    await page.getByLabel("Account ID (12 digits) or account alias").fill(DEMO.account_id);
    await page.getByRole("button", { name: "Next", exact: true }).click();
    await page.getByLabel("IAM username").fill(DEMO.username);
    await page.getByLabel("Password", { exact: true }).fill("not-the-password");
    await page.getByRole("button", { name: "Sign in", exact: true }).click();
    await expect(page.getByRole("alert").filter({ hasText: "Your authentication information is incorrect. Please try again." })).toBeVisible();
    await expect(page).toHaveURL(/\/login/);

    const me = await page.request.get("/api/auth/me");
    expect(me.status()).toBe(401);
  });

  test("required fields are validated before submitting", async ({ page }) => {
    await page.goto("/login");
    await page.getByRole("button", { name: "Next", exact: true }).click();
    await expect(visible(page, "Enter your account ID or account alias.")).toBeVisible();

    await page.getByLabel("Account ID (12 digits) or account alias").fill(DEMO.account_id);
    await page.getByRole("button", { name: "Next", exact: true }).click();
    await page.getByRole("button", { name: "Sign in", exact: true }).click();
    await expect(visible(page, "Enter your IAM username.")).toBeVisible();
    await expect(visible(page, "Enter your password.")).toBeVisible();
  });

  test("root user sign-in explains that only the demo IAM user exists", async ({ page }) => {
    await page.goto("/login");
    await page.getByLabel("Root user").check();
    await page.getByLabel("Email address").fill("owner@example.com");
    await page.getByRole("button", { name: "Next", exact: true }).click();
    await expect(page.getByRole("alert").filter({ hasText: "Root user sign-in isn't available" })).toBeVisible();
  });

  test("session survives a reload, and sign out ends it", async ({ page, context }) => {
    await signIn(page);
    const cookies = await context.cookies();
    const session = cookies.find((cookie) => cookie.name === "r53_session");
    expect(session?.httpOnly).toBe(true);

    await page.reload();
    await expect(page.getByRole("heading", { name: "Route 53 Dashboard", level: 1 })).toBeVisible();

    await page.getByRole("button", { name: /demo @ 1234-5678-9012/ }).click();
    await page.getByRole("menuitem", { name: "Sign out" }).click();
    await expect(page).toHaveURL(/\/$/);
    await expect(page.getByRole("heading", { name: "Route 53 Clone - DNS service", level: 1 })).toBeVisible();

    await page.goto("/route53/v2/hostedzones");
    await expect(page).toHaveURL(/\/login\?next=/);
    expect((await page.request.get("/api/auth/me")).status()).toBe(401);
  });
});
