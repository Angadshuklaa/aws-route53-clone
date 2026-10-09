import type { Metadata } from "next";

import { ComingSoon } from "@/components/common/ComingSoon";

export const metadata: Metadata = { title: "Traffic policies" };

export default function TrafficPoliciesPage() {
  return (
    <ComingSoon
      title="Traffic policies"
      description="Build complex routing configurations visually with traffic flow."
      breadcrumbs={[{ text: "Traffic flow", href: "/route53/v2/trafficpolicies" }]}
    />
  );
}
