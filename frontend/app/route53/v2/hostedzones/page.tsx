import type { Metadata } from "next";

import { HostedZonesPage } from "@/components/hosted-zones/HostedZonesPage";

export const metadata: Metadata = { title: "Hosted zones" };

export default async function Page({ searchParams }: PageProps<"/route53/v2/hostedzones">) {
  const { search } = await searchParams;
  const initialSearch = typeof search === "string" ? search : "";
  // Remount when the top navigation search changes the query string.
  return <HostedZonesPage key={initialSearch} initialSearch={initialSearch} />;
}
