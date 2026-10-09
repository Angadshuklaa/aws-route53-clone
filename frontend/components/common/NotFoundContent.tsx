"use client";

import Box from "@cloudscape-design/components/box";
import Button from "@cloudscape-design/components/button";
import SpaceBetween from "@cloudscape-design/components/space-between";
import { useRouter } from "next/navigation";

import { ROUTES } from "@/lib/routes";

export function NotFoundContent() {
  const router = useRouter();
  return (
    <div className="full-page-center">
      <SpaceBetween size="m" alignItems="center">
        <Box variant="h1">Page not found</Box>
        <Box color="text-body-secondary">The page you&apos;re looking for doesn&apos;t exist in the Route 53 console.</Box>
        <Button variant="primary" onClick={() => router.push(ROUTES.hostedZones)}>
          Go to Hosted zones
        </Button>
      </SpaceBetween>
    </div>
  );
}
