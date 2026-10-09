import type { ReactNode } from "react";

import { CloudscapeProvider } from "@/components/common/CloudscapeProvider";
import { CloudShellModal } from "@/components/layout/CloudShellModal";
import { ConsoleFooter } from "@/components/layout/ConsoleFooter";
import { ConsoleTopNav } from "@/components/layout/ConsoleTopNav";
import { KeyboardShortcuts } from "@/components/layout/KeyboardShortcuts";
import { RequireAuth } from "@/components/layout/RequireAuth";

export default function ConsoleRouteLayout({ children }: { children: ReactNode }) {
  return (
    <CloudscapeProvider>
      <RequireAuth>
        <ConsoleTopNav />
        <KeyboardShortcuts />
        <CloudShellModal />
        {children}
        <ConsoleFooter />
      </RequireAuth>
    </CloudscapeProvider>
  );
}
