"use client";

import Input, { type InputProps } from "@cloudscape-design/components/input";
import TopNavigation, { type TopNavigationProps } from "@cloudscape-design/components/top-navigation";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";

import { useAuth } from "@/lib/auth";
import { formatAccountId } from "@/lib/format";
import { useNotifications } from "@/lib/notifications";
import { usePreferences } from "@/lib/preferences";
import { EXTERNAL_LINKS, ROUTES } from "@/lib/routes";

function isMac(): boolean {
  try {
    return /Mac|iPhone|iPad/.test(navigator.platform || navigator.userAgent);
  } catch {
    return false;
  }
}

export function ConsoleTopNav() {
  const router = useRouter();
  const { user, logout } = useAuth();
  const { notify, history } = useNotifications();
  const { theme, setTheme, density, setDensity, setShortcutsVisible, setCloudShellVisible } = usePreferences();
  const [query, setQuery] = useState("");
  const [lastReadId, setLastReadId] = useState<string | null>(null);
  const [searchShortcut] = useState(() => (isMac() ? "[Option+S]" : "[Alt+S]"));
  const searchRef = useRef<InputProps.Ref>(null);

  const accountId = formatAccountId(user?.account_id ?? "");
  const unread = history.length > 0 && history[0].id !== lastReadId;

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.altKey && !event.metaKey && !event.ctrlKey && event.code === "KeyS") {
        event.preventDefault();
        searchRef.current?.focus();
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  const search = () => {
    const term = query.trim();
    router.push(term ? `${ROUTES.hostedZones}?search=${encodeURIComponent(term)}` : ROUTES.hostedZones);
  };

  const onSettingsClick: TopNavigationProps.MenuDropdownUtility["onItemClick"] = ({ detail }) => {
    if (detail.id === "theme-light") setTheme("light");
    if (detail.id === "theme-dark") setTheme("dark");
    if (detail.id === "density-comfortable") setDensity("comfortable");
    if (detail.id === "density-compact") setDensity("compact");
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

  const notificationItems: TopNavigationProps.MenuDropdownUtility["items"] =
    history.length === 0
      ? [{ id: "none", text: "No notifications yet", disabled: true }]
      : [
          {
            id: "recent",
            text: "Recent activity",
            items: history.map((item) => ({
              id: item.id,
              text: item.summary,
              description: item.time.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" }),
              iconName: item.type === "error" ? "status-negative" : item.type === "warning" ? "status-warning" : "status-positive",
            })),
          },
          { id: "mark-read", text: "Mark all as read", iconName: "check" },
        ];

  return (
    <div id="top-nav">
      <TopNavigation
        identity={{
          href: ROUTES.dashboard,
          logo: { src: "/logo.svg", alt: "Route 53 Clone console home" },
          onFollow: (event) => {
            event.preventDefault();
            router.push(ROUTES.dashboard);
          },
        }}
        search={
          <div className="console-search">
            <Input
              ref={searchRef}
              type="search"
              value={query}
              onChange={({ detail }) => setQuery(detail.value)}
              onKeyDown={({ detail }) => detail.key === "Enter" && search()}
              placeholder="Search"
              ariaLabel="Search hosted zones"
            />
            {!query && (
              <span className="console-search__hint" aria-hidden="true">
                {searchShortcut}
              </span>
            )}
          </div>
        }
        utilities={[
          {
            type: "button",
            iconName: "command-prompt",
            title: "CloudShell",
            ariaLabel: "CloudShell",
            onClick: () => setCloudShellVisible(true),
          },
          {
            type: "menu-dropdown",
            iconName: "notification",
            title: "Notifications",
            ariaLabel: unread ? "Notifications (unread)" : "Notifications",
            badge: unread,
            items: notificationItems,
            onItemClick: () => setLastReadId(history[0]?.id ?? null),
          },
          {
            type: "menu-dropdown",
            iconName: "support",
            title: "Support",
            ariaLabel: "Support",
            items: [
              { id: "shortcuts", text: "Keyboard shortcuts", iconName: "keyboard" },
              { id: "docs", text: "Documentation", href: EXTERNAL_LINKS.readme, external: true },
              { id: "api", text: "API reference", href: EXTERNAL_LINKS.apiDocs, external: true },
              { id: "source", text: "Source code", href: EXTERNAL_LINKS.repository, external: true },
            ],
            onItemClick: ({ detail }) => detail.id === "shortcuts" && setShortcutsVisible(true),
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
            ],
          },
          {
            type: "menu-dropdown",
            text: "Global",
            title: "Region",
            description: "Route 53 is a global service",
            items: [{ id: "global", text: "Route 53 doesn't require Region selection.", disabled: true }],
          },
          {
            type: "menu-dropdown",
            text: `${user?.username ?? ""} @ ${accountId}`,
            title: user?.username,
            description: `Account ID: ${accountId}`,
            onItemClick: onAccountClick,
            items: [
              { id: "copy-account", text: `Copy account ID (${accountId})`, iconName: "copy" },
              { id: "signout", text: "Sign out", iconName: "sign-out" },
            ],
          },
        ]}
      />
    </div>
  );
}
