import { expect, test } from "@playwright/test";

import { DEMO, signIn, visible } from "./helpers";

test.describe("authentication", () => {
  test("protected pages redirect to sign-in and return afterwards", async ({ page }) => {
    await page.goto("/route53/v2/healthchecks");
    await expect(page).toHaveURL(/\/login\?next=%2Froute53%2Fv2%2Fhealthchecks/);
    await expect(visible(page, "Sign in as IAM user")).toBeVisible();

    await page.getByRole("button", { name: "Fill in demo credentials" }).click();
    await page.getByRole("button", { name: "Sign in", exact: true }).click();
    await expect(page).toHaveURL(/\/route53\/v2\/healthchecks$/);
    await expect(page.getByRole("heading", { name: "Health checks", level: 1 })).toBeVisible();
  });

  test("wrong credentials show an error and no session is created", async ({ page }) => {
    await page.goto("/login");
    await page.getByLabel("IAM user name").fill(DEMO.username);
    await page.getByLabel("Password").fill("not-the-password");
    await page.getByRole("button", { name: "Sign in", exact: true }).click();
    await expect(visible(page, "Your authentication information is incorrect. Please try again.")).toBeVisible();
    await expect(page).toHaveURL(/\/login/);

    const me = await page.request.get("/api/auth/me");
    expect(me.status()).toBe(401);
  });

  test("required fields are validated before submitting", async ({ page }) => {
    await page.goto("/login");
    await page.getByLabel("Account ID (12 digits) or account alias").fill("");
    await page.getByRole("button", { name: "Sign in", exact: true }).click();
    await expect(visible(page, "Enter your account ID or alias.")).toBeVisible();
    await expect(visible(page, "Enter your IAM user name.")).toBeVisible();
    await expect(visible(page, "Enter your password.")).toBeVisible();
  });

  test("session survives a reload, and sign out ends it", async ({ page, context }) => {
    await signIn(page);
    const cookies = await context.cookies();
    const session = cookies.find((cookie) => cookie.name === "r53_session");
    expect(session?.httpOnly).toBe(true);

    await page.reload();
    await expect(page.getByRole("heading", { name: /Hosted zones/, level: 1 })).toBeVisible();
    await expect(page).toHaveURL(/\/route53\/v2\/hostedzones/);

    await page.getByRole("button", { name: /demo/ }).click();
    await page.getByRole("menuitem", { name: "Sign out" }).click();
    await expect(page).toHaveURL(/\/login$/);

    await page.goto("/route53/v2/hostedzones");
    await expect(page).toHaveURL(/\/login\?next=/);
    expect((await page.request.get("/api/auth/me")).status()).toBe(401);
  });
});
