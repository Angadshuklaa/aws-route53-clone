import { expect, test } from "@playwright/test";

import { applyFilter, choose, createZoneViaApi, deleteZonesViaApi, modal, signInToHostedZones, uniqueZoneName, visible } from "./helpers";

test.describe("hosted zones", () => {
  test.beforeEach(async ({ page }) => signInToHostedZones(page));
  test.afterEach(async ({ page }) => deleteZonesViaApi(page, "e2e-zone"));

  test("create, find, search, view, edit and delete a hosted zone", async ({ page }) => {
    const name = uniqueZoneName("zone");

    await page.getByRole("button", { name: "Create hosted zone", exact: true }).click();
    await expect(page).toHaveURL(/\/hostedzones\/create$/);
    await page.getByLabel("Domain name").fill("not a domain");
    await page.getByRole("button", { name: "Create hosted zone", exact: true }).click();
    await expect(visible(page, /isn't a valid label/)).toBeVisible();

    await page.getByLabel("Domain name").fill(name);
    await page.getByLabel(/Description/).fill("Created by Playwright");
    await page.getByRole("button", { name: "Create hosted zone", exact: true }).click();

    await expect(visible(page, `${name} was successfully created.`)).toBeVisible();
    await expect(page.getByRole("heading", { name, level: 1 })).toBeVisible();
    await expect(page.getByRole("tab", { name: "Records (2)" })).toBeVisible();
    const zoneUrl = page.url();

    await page.getByRole("link", { name: "Hosted zones" }).first().click();
    await applyFilter(page, "Filter hosted zones", name);
    await expect(visible(page, "1 match")).toBeVisible();
    const row = page.getByRole("row", { name: new RegExp(name.replace(/\./g, "\\.")) });
    await expect(row).toContainText("Created by Playwright");
    await expect(row).toContainText("Public");

    await row.getByRole("radio").check();
    await page.getByRole("button", { name: "Edit", exact: true }).click();
    const editDialog = modal(page);
    await expect(editDialog.getByLabel("Domain name")).toBeDisabled();
    await editDialog.getByLabel(/Description/).fill("Edited description");
    await editDialog.getByRole("button", { name: "Save changes" }).click();
    await expect(visible(page, `Hosted zone ${name} was updated successfully.`)).toBeVisible();
    await expect(row).toContainText("Edited description");

    await page.goto(zoneUrl);
    await expect(page.getByText("Edited description").first()).toBeVisible();

    await page.getByRole("button", { name: "Delete zone" }).click();
    await modal(page).getByRole("button", { name: "Cancel" }).click();
    await expect(page.getByRole("heading", { name, level: 1 })).toBeVisible();

    await page.getByRole("button", { name: "Delete zone" }).click();
    const deleteButton = modal(page).getByRole("button", { name: "Delete", exact: true });
    await expect(deleteButton).toBeDisabled();
    await modal(page).getByRole("textbox").fill("delete");
    await deleteButton.click();
    await expect(page).toHaveURL(/\/hostedzones$/);
    await expect(visible(page, `Hosted zone ${name} was deleted.`)).toBeVisible();

    await page.reload();
    await applyFilter(page, "Filter hosted zones", name);
    await expect(visible(page, "No matches")).toBeVisible();

    await page.goto(zoneUrl);
    await expect(visible(page, "This hosted zone doesn't exist")).toBeVisible();
  });

  test("private zones require a VPC and duplicates are rejected", async ({ page }) => {
    const name = uniqueZoneName("zone-private");
    await page.goto("/route53/v2/hostedzones/create");
    await page.getByLabel("Domain name").fill(name);
    await page.getByText("Private hosted zone", { exact: true }).click();
    await page.getByRole("button", { name: "Create hosted zone", exact: true }).click();
    await expect(visible(page, "Enter the ID of the VPC to associate with this zone.")).toBeVisible();

    await choose(page, page, "Region", /Europe \(Ireland\)/);
    await page.getByLabel("VPC ID").fill("vpc-0a1b2c3d");
    await page.getByRole("button", { name: "Create hosted zone", exact: true }).click();
    await expect(page.getByRole("heading", { name, level: 1 })).toBeVisible();
    await expect(visible(page, "vpc-0a1b2c3d (Europe (Ireland))")).toBeVisible();

    const publicName = uniqueZoneName("zone-dup");
    await createZoneViaApi(page, publicName);
    await page.goto("/route53/v2/hostedzones/create");
    await page.getByLabel("Domain name").fill(publicName);
    await page.getByRole("button", { name: "Create hosted zone", exact: true }).click();
    await expect(visible(page, `A public hosted zone for ${publicName} already exists.`)).toBeVisible();
  });

  test("type filter, pagination and clearing filters", async ({ page }) => {
    await applyFilter(page, "Filter hosted zones", "zzz-nothing-matches");
    await expect(visible(page, "No matches")).toBeVisible();
    await page.getByRole("button", { name: "Clear filters" }).first().click();
    await expect(visible(page, "No matches")).toBeHidden();

    await applyFilter(page, "Filter hosted zones", "Type = Private");
    const rows = page.locator("tbody tr");
    await expect(rows.filter({ hasText: "Private" }).first()).toBeVisible();
    await expect(rows.filter({ hasText: "Public" })).toHaveCount(0);

    await page.getByRole("button", { name: "Clear filters" }).first().click();
    const total = Number((await page.getByRole("heading", { name: /Hosted zones/, level: 1 }).innerText()).match(/\((\d+)\)/)?.[1]);
    if (total > 10) {
      await page.getByRole("button", { name: "Page 2 of all pages" }).click();
      await expect(page.getByRole("button", { name: "Page 2 of all pages" })).toHaveAttribute("aria-current", "true");
      await expect(rows.getByRole("link").first()).toBeVisible();
      expect(await rows.count()).toBeLessThanOrEqual(10);
    }
  });
});
