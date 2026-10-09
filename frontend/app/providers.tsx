"use client";

import type { ReactNode } from "react";

import { AuthProvider } from "@/lib/auth";
import { NotificationsProvider } from "@/lib/notifications";
import { PreferencesProvider } from "@/lib/preferences";

export function Providers({ children }: { children: ReactNode }) {
  return (
    <PreferencesProvider>
      <NotificationsProvider>
        <AuthProvider>{children}</AuthProvider>
      </NotificationsProvider>
    </PreferencesProvider>
  );
}
