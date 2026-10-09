import { expect, test, type Page } from "@playwright/test";

import { choose, createZoneViaApi, deleteZonesViaApi, modal, signIn, uniqueZoneName, visible } from "./helpers";

type Fields = Record<string, string>;

interface RecordCase {
  type: string;
  prefix: string;
  values: Fields[];
  shown: string[];
  edit: { values: Fields[]; shown: string[] };
}

const CASES: RecordCase[] = [
  { type: "A", prefix: "www", values: [{ "IPv4 address": "192.0.2.10" }, { "IPv4 address": "192.0.2.11" }], shown: ["192.0.2.10", "192.0.2.11"], edit: { values: [{ "IPv4 address": "198.51.100.7" }], shown: ["198.51.100.7"] } },
  { type: "AAAA", prefix: "www", values: [{ "IPv6 address": "2001:db8::1" }], shown: ["2001:db8::1"], edit: { values: [{ "IPv6 address": "2001:db8::2" }], shown: ["2001:db8::2"] } },
  { type: "CNAME", prefix: "blog", values: [{ "Domain name": "hosting.example.net" }], shown: ["hosting.example.net"], edit: { values: [{ "Domain name": "cdn.example.net" }], shown: ["cdn.example.net"] } },
  { type: "TXT", prefix: "", values: [{ Text: 'v=spf1 include:_spf.example.com ~all' }], shown: ['"v=spf1 include:_spf.example.com ~all"'], edit: { values: [{ Text: 'say "hi"' }], shown: ['"say \\"hi\\""'] } },
  { type: "MX", prefix: "", values: [{ Priority: "10", "Mail server": "mail.example.com" }], shown: ["10 mail.example.com"], edit: { values: [{ Priority: "20", "Mail server": "mx.example.com" }], shown: ["20 mx.example.com"] } },
  { type: "NS", prefix: "dev", values: [{ "Name server": "ns-1.example.net" }], shown: ["ns-1.example.net"], edit: { values: [{ "Name server": "ns-9.example.net" }], shown: ["ns-9.example.net"] } },
  { type: "PTR", prefix: "10", values: [{ "Domain name": "host.example.com" }], shown: ["host.example.com"], edit: { values: [{ "Domain name": "other.example.com" }], shown: ["other.example.com"] } },
  { type: "SRV", prefix: "_sip._tcp", values: [{ Priority: "10", Weight: "60", Port: "5060", Target: "sip.example.com" }], shown: ["10 60 5060 sip.example.com"], edit: { values: [{ Priority: "1", Weight: "5", Port: "5061", Target: "sips.example.com" }], shown: ["1 5 5061 sips.example.com"] } },
  { type: "CAA", prefix: "", values: [{ Flags: "0", Value: "amazon.com" }], shown: ['0 issue "amazon.com"'], edit: { values: [{ Flags: "0", Value: "letsencrypt.org" }], shown: ['0 issue "letsencrypt.org"'] } },
];

async function fillValues(page: Page, values: Fields[]) {
  const dialog = modal(page);
  while ((await dialog.getByRole("button", { name: "Remove" }).count()) > 0 && (await dialog.getByRole("button", { name: "Remove" }).first().isEnabled())) {
    await dialog.getByRole("button", { name: "Remove" }).last().click();
  }
  for (const [index, fields] of values.entries()) {
    if (index > 0) await dialog.getByRole("button", { name: "Add another value" }).click();
    for (const [label, value] of Object.entries(fields)) {
      await dialog.getByLabel(`${label} ${index + 1}`, { exact: true }).fill(value);
    }
  }
}

function recordLink(page: Page, name: string, type: string) {
  return page.getByRole("button", { name: `Edit ${name} ${type}`, exact: true });
}

function recordRow(page: Page, name: string, type: string) {
  return page.locator("tbody tr").filter({ has: recordLink(page, name, type) });
}

test.describe("DNS records", () => {
  let zone: { id: string; name: string };

  test.beforeEach(async ({ page }) => {
    await signIn(page);
    zone = await createZoneViaApi(page, uniqueZoneName("records"));
    await page.goto(`/route53/v2/hostedzones/${zone.id}`);
    await expect(page.getByRole("heading", { name: zone.name, level: 1 })).toBeVisible();
  });

  test.afterEach(async ({ page }) => deleteZonesViaApi(page, "e2e-records"));

  test("create, view, edit and delete every record type", async ({ page }) => {
    test.setTimeout(240_000);
    for (const item of CASES) {
      const fqdn = item.prefix ? `${item.prefix}.${zone.name}` : zone.name;

      await page.getByRole("button", { name: "Create record" }).first().click();
      const dialog = modal(page);
      await dialog.getByLabel("Record name", { exact: true }).fill(item.prefix);
      await choose(dialog, page, "Record type", new RegExp(`(^|\\s)${item.type} – `));
      await fillValues(page, item.values);
      await dialog.getByRole("button", { name: "Create records" }).click();
      await expect(visible(page, `Record ${fqdn} (${item.type}) was created successfully.`)).toBeVisible();
      await expect(dialog).toBeHidden();

      const row = recordRow(page, fqdn, item.type);
      for (const value of item.shown) await expect(row).toContainText(value);

      await recordLink(page, fqdn, item.type).click();
      await expect(modal(page).getByLabel("TTL (seconds)")).toHaveValue("300");
      await fillValues(page, item.edit.values);
      await modal(page).getByLabel("TTL (seconds)").fill("3600");
      await modal(page).getByRole("button", { name: "Save", exact: true }).click();
      await expect(visible(page, `Record ${fqdn} (${item.type}) was updated successfully.`)).toBeVisible();
      for (const value of item.edit.shown) await expect(row).toContainText(value);
      await expect(row).toContainText("3600");
    }

    await page.reload();
    await expect(page.getByRole("tab", { name: `Records (${CASES.length + 2})` })).toBeVisible();
    for (const item of CASES) {
      const fqdn = item.prefix ? `${item.prefix}.${zone.name}` : zone.name;
      await expect(recordRow(page, fqdn, item.type)).toContainText(item.edit.shown[0]);
    }

    for (const item of CASES) {
      const fqdn = item.prefix ? `${item.prefix}.${zone.name}` : zone.name;
      const row = recordRow(page, fqdn, item.type);
      await row.getByRole("checkbox").check();
      await page.getByRole("button", { name: "Delete record", exact: true }).first().click();
      await modal(page).getByRole("button", { name: "Delete", exact: true }).click();
      await expect(visible(page, `Record ${fqdn} (${item.type}) was deleted.`)).toBeVisible();
      await expect(row).toHaveCount(0);
    }
    await page.reload();
    await expect(page.getByRole("tab", { name: "Records (2)" })).toBeVisible();
  });

  test("validation errors are shown inline and from the API", async ({ page }) => {
    await page.getByRole("button", { name: "Create record" }).first().click();
    const dialog = modal(page);
    await dialog.getByLabel("Record name", { exact: true }).fill("bad..name");
    await dialog.getByLabel("IPv4 address 1", { exact: true }).fill("999.1.1.1");
    await dialog.getByRole("button", { name: "Create records" }).click();
    await expect(visible(dialog, "Enter a valid IPv4 address, such as 192.0.2.44.")).toBeVisible();
    await expect(visible(dialog, /empty labels/)).toBeVisible();

    await dialog.getByLabel("Record name", { exact: true }).fill("");
    await choose(dialog, page, "Record type", /(^|\s)CNAME – /);
    await dialog.getByLabel("Domain name 1", { exact: true }).fill("target.example.net");
    await dialog.getByRole("button", { name: "Create records" }).click();
    await expect(visible(dialog, /You can't create a CNAME record at the zone apex/)).toBeVisible();

    await dialog.getByRole("button", { name: "Cancel" }).click();
    await expect(dialog).toBeHidden();
    await expect(page.getByRole("tab", { name: "Records (2)" })).toBeVisible();
  });

  test("search, type filter, bulk delete and the zone-file import/export", async ({ page }) => {
    const zoneFile = [
      `$ORIGIN ${zone.name}.`,
      "$TTL 300",
      "shop      IN CNAME shop.example.net.",
      "shop-api  IN A     192.0.2.50",
      "cdn       IN CNAME assets.shop-cdn.example.net.",
      "mail      IN A     192.0.2.25",
      "@         IN MX    10 mail",
      "bad       IN A     300.1.1.1",
    ].join("\n");

    await page.getByRole("button", { name: "Import zone file" }).click();
    await modal(page).getByLabel("Zone file contents").fill(zoneFile);
    await modal(page).getByRole("button", { name: "Import", exact: true }).click();
    await expect(visible(modal(page), "Imported 5 records")).toBeVisible();
    await expect(visible(modal(page), /Line 8: Invalid A data/)).toBeVisible();
    await modal(page).getByRole("button", { name: "Done" }).click();
    await expect(page.getByRole("tab", { name: "Records (7)" })).toBeVisible();

    const filter = page.getByRole("searchbox", { name: "Filter records" });
    await filter.fill("shop");
    await expect(visible(page, "3 matches")).toBeVisible();
    await choose(page, page, "Filter by record type", "CNAME");
    await expect(visible(page, "2 matches")).toBeVisible();
    const rows = page.locator("tbody tr");
    await expect(rows).toHaveCount(2);
    for (const text of await rows.allInnerTexts()) expect(text).toContain("CNAME");

    await page.getByRole("button", { name: "Clear filters" }).first().click();
    await expect(rows).toHaveCount(7);

    await choose(page, page, "Filter by record type", "CNAME");
    await expect(rows).toHaveCount(2);
    await page.getByRole("checkbox", { name: "Select all records on this page" }).check();
    await page.getByRole("button", { name: "Delete records" }).click();
    await modal(page).getByRole("button", { name: "Delete", exact: true }).click();
    await expect(visible(page, "Deleted 2 records.")).toBeVisible();
    await page.getByRole("button", { name: "Clear filters" }).first().click();
    await expect(page.getByRole("tab", { name: "Records (5)" })).toBeVisible();

    await page.getByRole("button", { name: "Export zone file" }).click();
    const downloadPromise = page.waitForEvent("download");
    await page.getByRole("menuitem", { name: /BIND zone file/ }).click();
    const download = await downloadPromise;
    expect(download.suggestedFilename()).toBe(`${zone.name}.zone`);
    const text = await (await download.createReadStream()).toArray().then((chunks) => Buffer.concat(chunks).toString());
    expect(text).toContain(`$ORIGIN ${zone.name}.`);
    expect(text).toContain("shop-api");
    expect(text).not.toContain("shop.example.net");
  });

  test("records stay inside their own zone", async ({ page }) => {
    const other = await createZoneViaApi(page, uniqueZoneName("records-other"));
    await page.request.post(`/api/hosted-zones/${zone.id}/records`, {
      data: { name: `only-here.${zone.name}`, type: "A", ttl: 300, values: [{ value: "192.0.2.1" }] },
    });
    await page.goto(`/route53/v2/hostedzones/${other.id}`);
    await expect(page.getByRole("tab", { name: "Records (2)" })).toBeVisible();
    await expect(page.getByText("only-here")).toHaveCount(0);
  });
});
