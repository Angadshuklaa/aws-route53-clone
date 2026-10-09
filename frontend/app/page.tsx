import type { Metadata } from "next";

import { LandingPage } from "@/components/landing/LandingPage";

export const metadata: Metadata = {
  title: { absolute: "Route 53 Clone - DNS Service" },
  description: "A functional clone of the Route 53 console for managing hosted zones and DNS records.",
};

export default function Home() {
  return <LandingPage />;
}
