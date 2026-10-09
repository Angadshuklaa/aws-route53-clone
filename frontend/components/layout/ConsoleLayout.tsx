"use client";

import type { AppLayoutProps } from "@cloudscape-design/components/app-layout";
import AppLayoutToolbar from "@cloudscape-design/components/app-layout-toolbar";
import BreadcrumbGroup, { type BreadcrumbGroupProps } from "@cloudscape-design/components/breadcrumb-group";
import Flashbar from "@cloudscape-design/components/flashbar";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";

import { useFollow } from "@/components/common/navigation";
import { RouteSideNav } from "@/components/layout/RouteSideNav";
import { useNotifications } from "@/lib/notifications";
import { usePreferences } from "@/lib/preferences";

export interface ConsoleLayoutProps {
  breadcrumbs: BreadcrumbGroupProps.Item[];
  content: ReactNode;
  contentType?: AppLayoutProps.ContentType;
  tools?: ReactNode;
  toolsOpen?: boolean;
  onToolsChange?: (open: boolean) => void;
  splitPanel?: ReactNode;
  splitPanelOpen?: boolean;
  onSplitPanelToggle?: (open: boolean) => void;
}

export function ConsoleLayout({
  breadcrumbs,
  content,
  contentType = "default",
  tools,
  toolsOpen,
  onToolsChange,
  splitPanel,
  splitPanelOpen,
  onSplitPanelToggle,
}: ConsoleLayoutProps) {
  const pathname = usePathname();
  const follow = useFollow();
  const { items } = useNotifications();
  const { navigationOpen, setNavigationOpen, splitPanelPreferences, setSplitPanelPreferences, splitPanelSize, setSplitPanelSize } =
    usePreferences();

  return (
    <AppLayoutToolbar
      headerSelector="#top-nav"
      footerSelector="#console-footer"
      navigation={<RouteSideNav pathname={pathname} />}
      navigationOpen={navigationOpen}
      onNavigationChange={({ detail }) => setNavigationOpen(detail.open)}
      breadcrumbs={<BreadcrumbGroup items={breadcrumbs} onFollow={follow} ariaLabel="Breadcrumbs" />}
      notifications={<Flashbar items={items} stackItems={items.length > 2} />}
      stickyNotifications
      content={content}
      contentType={contentType}
      tools={tools}
      toolsHide={!tools}
      toolsOpen={toolsOpen ?? false}
      onToolsChange={({ detail }) => onToolsChange?.(detail.open)}
      splitPanel={splitPanel}
      splitPanelOpen={splitPanelOpen ?? false}
      onSplitPanelToggle={({ detail }) => onSplitPanelToggle?.(detail.open)}
      splitPanelSize={splitPanelSize}
      onSplitPanelResize={({ detail }) => setSplitPanelSize(detail.size)}
      splitPanelPreferences={splitPanelPreferences}
      onSplitPanelPreferencesChange={({ detail }) => setSplitPanelPreferences(detail)}
    />
  );
}
