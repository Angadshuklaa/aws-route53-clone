"use client";

import { I18nProvider } from "@cloudscape-design/components/i18n";
import enMessages from "@cloudscape-design/components/i18n/messages/all.en";
import type { ReactNode } from "react";

export function CloudscapeProvider({ children }: { children: ReactNode }) {
  return (
    <I18nProvider locale="en" messages={[enMessages]}>
      {children}
    </I18nProvider>
  );
}
