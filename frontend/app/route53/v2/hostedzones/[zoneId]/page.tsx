import type { Metadata } from "next";

import { HostedZoneDetailPage } from "@/components/hosted-zones/HostedZoneDetailPage";

export const metadata: Metadata = { title: "Hosted zone details" };

export default async function Page({ params }: PageProps<"/route53/v2/hostedzones/[zoneId]">) {
  const { zoneId } = await params;
  // Remount on navigation between zones so no state leaks from the previous zone.
  return <HostedZoneDetailPage key={zoneId} zoneId={decodeURIComponent(zoneId)} />;
}
