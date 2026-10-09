import "@cloudscape-design/global-styles/index.css";
import "./globals.css";

import type { Metadata, Viewport } from "next";

import { THEME_BOOT_SCRIPT } from "@/lib/themeBoot";

import { Providers } from "./providers";

export const metadata: Metadata = {
  title: { default: "Route 53 Clone", template: "%s | Route 53 Clone" },
  description: "A functional clone of the Route 53 console for managing hosted zones and DNS records.",
  robots: { index: false, follow: false },
};

export const viewport: Viewport = { width: "device-width", initialScale: 1 };

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en">
      <body suppressHydrationWarning>
        <script dangerouslySetInnerHTML={{ __html: THEME_BOOT_SCRIPT }} />
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
