"use client";

import SideNavigation, { type SideNavigationProps } from "@cloudscape-design/components/side-navigation";

import { useFollow } from "@/components/common/navigation";
import { RESOLVER_SECTIONS, ROUTES } from "@/lib/routes";

const ITEMS: SideNavigationProps.Item[] = [
  { type: "link", text: "Dashboard", href: ROUTES.dashboard },
  { type: "link", text: "Hosted zones", href: ROUTES.hostedZones },
  { type: "link", text: "Health checks", href: ROUTES.healthChecks },
  { type: "link", text: "Profiles", href: ROUTES.profiles },
  {
    type: "section",
    text: "Traffic flow",
    items: [{ type: "link", text: "Traffic policies", href: ROUTES.trafficPolicies }],
  },
  {
    type: "section",
    text: "Resolver",
    defaultExpanded: false,
    items: Object.entries(RESOLVER_SECTIONS).map(([slug, text]) => ({
      type: "link" as const,
      text,
      href: ROUTES.resolver(slug),
    })),
  },
];

function activeHrefFor(pathname: string): string {
  // Zone detail and create pages highlight "Hosted zones".
  if (pathname.startsWith(ROUTES.hostedZones)) return ROUTES.hostedZones;
  return pathname;
}

export function RouteSideNav({ pathname }: { pathname: string }) {
  const follow = useFollow();
  return (
    <SideNavigation
      header={{ text: "Route 53", href: ROUTES.dashboard }}
      activeHref={activeHrefFor(pathname)}
      items={ITEMS}
      onFollow={follow}
    />
  );
}
