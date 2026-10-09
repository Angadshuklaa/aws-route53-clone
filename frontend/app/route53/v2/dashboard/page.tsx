import type { Metadata } from "next";

import { ComingSoon } from "@/components/common/ComingSoon";

export const metadata: Metadata = { title: "Dashboard" };

export default function DashboardPage() {
  return <ComingSoon title="Dashboard" description="An overview of your DNS management, traffic management and availability monitoring." />;
}
