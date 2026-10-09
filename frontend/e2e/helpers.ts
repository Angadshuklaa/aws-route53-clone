import { expect, type Locator, type Page } from "@playwright/test";

export const DEMO = { account_id: "123456789012", username: "demo", password: "Route53Demo!" };

export const uniqueZoneName = (label: string) =>
  `e2e-${label}-${Date.now().toString(36)}${Math.floor(Math.random() * 1e4)}.example`;

export async function signIn(page: Page, nextPath?: string): Promise<void> {
  await page.goto(nextPath ? `/login?next=${encodeURIComponent(nextPath)}` : "/login");
  await page.getByLabel("Account ID (12 digits) or account alias").fill(DEMO.account_id);
  await page.getByRole("button", { name: "Next", exact: true }).click();
  await page.getByLabel("IAM username").fill(DEMO.username);
  await page.getByLabel("Password", { exact: true }).fill(DEMO.password);
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await expect(page).toHaveURL(new RegExp(nextPath ? nextPath.replace(/[.*+?^${}()|[\]\\]/g, "\\$&") : "/route53/v2/dashboard"));
}

export async function signInToHostedZones(page: Page): Promise<void> {
  await signIn(page, "/route53/v2/hostedzones");
  await expect(page.getByRole("heading", { name: /Hosted zones/, level: 1 })).toBeVisible();
}

export async function createZoneViaApi(page: Page, name: string, extra: Record<string, unknown> = {}) {
  const response = await page.request.post("/api/hosted-zones", { data: { name, ...extra } });
  expect(response.status(), await response.text()).toBe(201);
  return (await response.json()) as { id: string; name: string };
}

export async function deleteZonesViaApi(page: Page, prefix = "e2e-"): Promise<void> {
  const response = await page.request.get("/api/hosted-zones", { params: { search: prefix, page_size: 100 } });
  if (!response.ok()) return;
  const { items } = (await response.json()) as { items: { id: string; name: string }[] };
  for (const zone of items.filter((item) => item.name.startsWith(prefix))) {
    await page.request.delete(`/api/hosted-zones/${zone.id}`);
  }
}

export async function choose(scope: Page | Locator, page: Page, selectLabel: string, option: string | RegExp) {
  await scope.getByRole("button", { name: selectLabel }).and(scope.locator("[aria-haspopup]")).first().click();
  await page.getByRole("option", { name: option }).first().click();
}

export function visible(scope: Page | Locator, text: string | RegExp): Locator {
  return scope.getByText(text).filter({ visible: true }).first();
}

export function modal(page: Page): Locator {
  return page.getByRole("dialog");
}
