import type { Metadata } from "next";

import { HostedZonesPage } from "@/components/hosted-zones/HostedZonesPage";

export const metadata: Metadata = { title: "Hosted zones" };

export default async function Page({ searchParams }: PageProps<"/route53/v2/hostedzones">) {
  const { search } = await searchParams;
  const initialSearch = typeof search === "string" ? search : "";
  return <HostedZonesPage key={initialSearch} initialSearch={initialSearch} />;
}
