import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { ComingSoon } from "@/components/common/ComingSoon";
import { RESOLVER_SECTIONS } from "@/lib/routes";

export function generateStaticParams() {
  return Object.keys(RESOLVER_SECTIONS).map((section) => ({ section }));
}

export const dynamicParams = false;

export async function generateMetadata({ params }: PageProps<"/route53/v2/resolver/[section]">): Promise<Metadata> {
  const { section } = await params;
  return { title: `Resolver ${RESOLVER_SECTIONS[section] ?? ""}`.trim() };
}

export default async function ResolverPage({ params }: PageProps<"/route53/v2/resolver/[section]">) {
  const { section } = await params;
  const title = RESOLVER_SECTIONS[section];
  if (!title) notFound();
  return (
    <ComingSoon
      title={title}
      description="Route 53 Resolver answers DNS queries for VPCs and forwards queries between VPCs and your network."
      breadcrumbs={[{ text: "Resolver", href: "/route53/v2/resolver/vpcs" }]}
    />
  );
}
