"use client";

import Badge from "@cloudscape-design/components/badge";
import Box from "@cloudscape-design/components/box";
import Button from "@cloudscape-design/components/button";
import Container from "@cloudscape-design/components/container";
import ContentLayout from "@cloudscape-design/components/content-layout";
import Header from "@cloudscape-design/components/header";
import Icon from "@cloudscape-design/components/icon";
import SpaceBetween from "@cloudscape-design/components/space-between";
import { useRouter } from "next/navigation";

import { ConsoleLayout } from "@/components/layout/ConsoleLayout";
import { ROUTES } from "@/lib/routes";

interface ComingSoonProps {
  title: string;
  description: string;
  breadcrumbs?: { text: string; href: string }[];
}

/** Placeholder for console sections that this clone doesn't implement. */
export function ComingSoon({ title, description, breadcrumbs = [] }: ComingSoonProps) {
  const router = useRouter();
  return (
    <ConsoleLayout
      breadcrumbs={[{ text: "Route 53", href: ROUTES.dashboard }, ...breadcrumbs, { text: title, href: "" }]}
      content={
        <ContentLayout
          header={
            <Header variant="h1" description={description} actions={<Badge color="grey">Coming soon</Badge>}>
              {title}
            </Header>
          }
        >
          <Container>
            <div className="coming-soon">
              <SpaceBetween size="m" alignItems="center">
                <Icon name="status-in-progress" size="large" variant="subtle" />
                <Box variant="h2" tagOverride="p">
                  {title} is coming soon
                </Box>
                <Box color="text-body-secondary">
                  This section isn&apos;t available in the Route 53 clone yet. Hosted zones and DNS records are fully
                  functional.
                </Box>
                <Button onClick={() => router.push(ROUTES.hostedZones)}>Go to Hosted zones</Button>
              </SpaceBetween>
            </div>
          </Container>
        </ContentLayout>
      }
    />
  );
}
