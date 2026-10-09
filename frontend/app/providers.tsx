"use client";

import { I18nProvider } from "@cloudscape-design/components/i18n";
import enMessages from "@cloudscape-design/components/i18n/messages/all.en";
import type { ReactNode } from "react";

import { AuthProvider } from "@/lib/auth";
import { NotificationsProvider } from "@/lib/notifications";
import { PreferencesProvider } from "@/lib/preferences";

export function Providers({ children }: { children: ReactNode }) {
  return (
    <I18nProvider locale="en" messages={[enMessages]}>
      <PreferencesProvider>
        <NotificationsProvider>
          <AuthProvider>{children}</AuthProvider>
        </NotificationsProvider>
      </PreferencesProvider>
    </I18nProvider>
  );
}
