"use client";

import Input from "@cloudscape-design/components/input";
import TopNavigation, { type TopNavigationProps } from "@cloudscape-design/components/top-navigation";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { ROUTES } from "@/lib/routes";
import { useAuth } from "@/lib/auth";
import { formatAccountId } from "@/lib/format";
import { useNotifications } from "@/lib/notifications";
import { usePreferences } from "@/lib/preferences";

export function ConsoleTopNav() {
  const router = useRouter();
  const { user, logout } = useAuth();
  const { notify } = useNotifications();
  const { theme, setTheme, density, setDensity, setShortcutsVisible } = usePreferences();
  const [query, setQuery] = useState("");

  const accountId = formatAccountId(user?.account_id ?? "");

  const search = () => {
    const term = query.trim();
    router.push(term ? `${ROUTES.hostedZones}?search=${encodeURIComponent(term)}` : ROUTES.hostedZones);
  };

  const onSettingsClick: TopNavigationProps.MenuDropdownUtility["onItemClick"] = ({ detail }) => {
    if (detail.id === "theme-light") setTheme("light");
    if (detail.id === "theme-dark") setTheme("dark");
    if (detail.id === "density-comfortable") setDensity("comfortable");
    if (detail.id === "density-compact") setDensity("compact");
    if (detail.id === "shortcuts") setShortcutsVisible(true);
  };

  const onAccountClick: TopNavigationProps.MenuDropdownUtility["onItemClick"] = async ({ detail }) => {
    if (detail.id === "copy-account") {
      try {
        await navigator.clipboard.writeText(user?.account_id ?? "");
        notify({ type: "success", content: "Account ID copied to the clipboard." });
      } catch {
        notify({ type: "error", content: "The account ID couldn't be copied. Your browser blocked clipboard access." });
      }
    }
    if (detail.id === "signout") await logout();
  };

  const check = (active: boolean) => (active ? ("check" as const) : undefined);

  return (
    <div id="top-nav">
      <TopNavigation
        identity={{
          href: ROUTES.hostedZones,
          title: "Route 53 Clone",
          logo: { src: "/logo.svg", alt: "" },
          onFollow: (event) => {
            event.preventDefault();
            router.push(ROUTES.hostedZones);
          },
        }}
        search={
          <Input
            type="search"
            value={query}
            onChange={({ detail }) => setQuery(detail.value)}
            onKeyDown={({ detail }) => detail.key === "Enter" && search()}
            placeholder="Search hosted zones"
            ariaLabel="Search hosted zones"
          />
        }
        utilities={[
          {
            type: "menu-dropdown",
            text: "Global",
            iconName: "globe",
            title: "Region",
            description: "Route 53 is a global service",
            items: [{ id: "global", text: "Route 53 doesn't require Region selection.", disabled: true }],
          },
          {
            type: "menu-dropdown",
            iconName: "settings",
            title: "Settings",
            ariaLabel: "Settings",
            onItemClick: onSettingsClick,
            items: [
              {
                id: "theme",
                text: "Visual mode",
                items: [
                  { id: "theme-light", text: "Light", iconName: check(theme === "light") },
                  { id: "theme-dark", text: "Dark", iconName: check(theme === "dark") },
                ],
              },
              {
                id: "density",
                text: "Density",
                items: [
                  { id: "density-comfortable", text: "Comfortable", iconName: check(density === "comfortable") },
                  { id: "density-compact", text: "Compact", iconName: check(density === "compact") },
                ],
              },
              { id: "shortcuts", text: "Keyboard shortcuts", iconName: "keyboard" },
            ],
          },
          {
            type: "menu-dropdown",
            text: user?.username ?? "",
            description: `Account ID: ${accountId}`,
            iconName: "user-profile",
            onItemClick: onAccountClick,
            items: [
              { id: "copy-account", text: "Copy account ID", iconName: "copy" },
              { id: "signout", text: "Sign out", iconName: "sign-out" },
            ],
          },
        ]}
      />
    </div>
  );
}
