import type { Metadata } from "next";

import { CreateHostedZonePage } from "@/components/hosted-zones/CreateHostedZonePage";

export const metadata: Metadata = { title: "Create hosted zone" };

export default function Page() {
  return <CreateHostedZonePage />;
}
