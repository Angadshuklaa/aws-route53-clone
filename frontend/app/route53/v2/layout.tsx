import type { ReactNode } from "react";

import { ConsoleTopNav } from "@/components/layout/ConsoleTopNav";
import { KeyboardShortcuts } from "@/components/layout/KeyboardShortcuts";
import { RequireAuth } from "@/components/layout/RequireAuth";

export default function ConsoleRouteLayout({ children }: { children: ReactNode }) {
  return (
    <RequireAuth>
      <ConsoleTopNav />
      <KeyboardShortcuts />
      {children}
    </RequireAuth>
  );
}
