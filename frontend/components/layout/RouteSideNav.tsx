"use client";

import SideNavigation, { type SideNavigationProps } from "@cloudscape-design/components/side-navigation";

import { useFollow } from "@/components/common/navigation";
import { PLACEHOLDER_SECTIONS, placeholderHref, ROUTES } from "@/lib/routes";

const link = (slug: string): SideNavigationProps.Link => ({
  type: "link",
  text: PLACEHOLDER_SECTIONS[slug].title,
  href: placeholderHref(slug),
});

const section = (text: string, slugs: string[]): SideNavigationProps.Section => ({
  type: "section",
  text,
  defaultExpanded: false,
  items: slugs.map(link),
});

const ITEMS: SideNavigationProps.Item[] = [
  { type: "link", text: "Dashboard", href: ROUTES.dashboard },
  { type: "link", text: "Hosted zones", href: ROUTES.hostedZones },
  link("healthchecks"),
  link("profiles"),
  section("IP-based routing", ["cidrcollections"]),
  section("Traffic flow", ["trafficpolicies", "policyrecords"]),
  section("Domains", ["domains/registered", "domains/requests"]),
  section("Resolver", [
    "resolver/vpcs",
    "resolver/inbound-endpoints",
    "resolver/outbound-endpoints",
    "resolver/rules",
    "resolver/query-logging",
  ]),
  section("DNS Firewall", ["dnsfirewall/rule-groups", "dnsfirewall/domain-lists"]),
];

function activeHrefFor(pathname: string): string {
  if (pathname.startsWith(ROUTES.hostedZones)) return ROUTES.hostedZones;
  return pathname;
}

export function RouteSideNav({ pathname }: { pathname: string }) {
  const follow = useFollow();
  const activeHref = activeHrefFor(pathname);
  const items = ITEMS.map((item) =>
    item.type === "section" && item.items.some((child) => child.type === "link" && child.href === activeHref)
      ? { ...item, defaultExpanded: true }
      : item,
  );
  return (
    <SideNavigation
      header={{ text: "Route 53", href: ROUTES.dashboard }}
      activeHref={activeHref}
      items={items}
      onFollow={follow}
    />
  );
}
