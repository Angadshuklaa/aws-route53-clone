import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { ComingSoon } from "@/components/common/ComingSoon";
import { PLACEHOLDER_SECTIONS, placeholderHref } from "@/lib/routes";

type Props = PageProps<"/route53/v2/[...section]">;

export function generateStaticParams() {
  return Object.keys(PLACEHOLDER_SECTIONS).map((slug) => ({ section: slug.split("/") }));
}

export const dynamicParams = false;

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { section } = await params;
  return { title: PLACEHOLDER_SECTIONS[section.join("/")]?.title ?? "Not found" };
}

/** "Coming soon" pages for the Route 53 sections this clone doesn't implement. */
export default async function PlaceholderPage({ params }: Props) {
  const { section } = await params;
  const slug = section.join("/");
  const config = PLACEHOLDER_SECTIONS[slug];
  if (!config) notFound();
  return (
    <ComingSoon
      title={config.title}
      description={config.description}
      breadcrumbs={config.group ? [{ text: config.group, href: placeholderHref(slug) }] : []}
    />
  );
}
