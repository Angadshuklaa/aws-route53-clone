"use client";

import Alert from "@cloudscape-design/components/alert";
import Badge from "@cloudscape-design/components/badge";
import Box from "@cloudscape-design/components/box";
import Button from "@cloudscape-design/components/button";
import Container from "@cloudscape-design/components/container";
import ContentLayout from "@cloudscape-design/components/content-layout";
import Grid from "@cloudscape-design/components/grid";
import Header from "@cloudscape-design/components/header";
import HelpPanel from "@cloudscape-design/components/help-panel";
import Link from "@cloudscape-design/components/link";
import SpaceBetween from "@cloudscape-design/components/space-between";
import Table from "@cloudscape-design/components/table";
import { useRouter } from "next/navigation";
import { useEffect, useState, type ReactNode } from "react";

import { useFollow } from "@/components/common/navigation";
import { TableEmptyState } from "@/components/common/TableStates";
import { ConsoleLayout } from "@/components/layout/ConsoleLayout";
import { errorMessage, isAbortError } from "@/lib/api/client";
import { dashboardApi } from "@/lib/api/endpoints";
import { ALL_RECORD_TYPES } from "@/lib/dns";
import { formatDateTime, zoneTypeLabel } from "@/lib/format";
import { placeholderHref, ROUTES } from "@/lib/routes";
import type { DashboardSummary, RecordType } from "@/lib/types";

function DashboardHelp() {
  return (
    <HelpPanel header={<h2>Route 53 dashboard</h2>}>
      <p>The dashboard summarizes the Route 53 resources in this account.</p>
      <p>
        <strong>DNS management</strong> counts your hosted zones and the records in them. The other areas are shown for
        completeness and are coming soon in this clone.
      </p>
    </HelpPanel>
  );
}

interface AreaProps {
  title: string;
  description: string;
  count: ReactNode;
  unit: string;
  footer: ReactNode;
  comingSoon?: boolean;
}

function Area({ title, description, count, unit, footer, comingSoon }: AreaProps) {
  return (
    <Container
      fitHeight
      header={
        <Header variant="h2" description={description} actions={comingSoon ? <Badge color="grey">Coming soon</Badge> : undefined}>
          {title}
        </Header>
      }
      footer={footer}
    >
      <SpaceBetween size="xxs">
        <Box variant="awsui-value-large" tagOverride="p">
          {count}
        </Box>
        <Box color="text-body-secondary">{unit}</Box>
      </SpaceBetween>
    </Container>
  );
}

export function DashboardPage() {
  const router = useRouter();
  const follow = useFollow();
  const [summary, setSummary] = useState<DashboardSummary | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);
  const [toolsOpen, setToolsOpen] = useState(false);

  useEffect(() => {
    const controller = new AbortController();
    dashboardApi.summary(controller.signal).then(
      (data) => {
        setSummary(data);
        setError(null);
      },
      (err: unknown) => {
        if (!isAbortError(err)) setError(errorMessage(err));
      },
    );
    return () => controller.abort();
  }, [reloadKey]);

  const loading = summary === null && error === null;
  const value = (n: number | undefined) => (loading || n === undefined ? "-" : n);
  const typeRows = ALL_RECORD_TYPES.map((type) => ({ type, count: summary?.records_by_type[type as RecordType] ?? 0 }));

  return (
    <ConsoleLayout
      breadcrumbs={[
        { text: "Route 53", href: ROUTES.dashboard },
        { text: "Dashboard", href: ROUTES.dashboard },
      ]}
      tools={<DashboardHelp />}
      toolsOpen={toolsOpen}
      onToolsChange={setToolsOpen}
      content={
        <ContentLayout
          header={
            <Header
              variant="h1"
              info={
                <Link variant="info" onFollow={() => setToolsOpen(true)}>
                  Info
                </Link>
              }
              description="Route 53 is a highly available DNS service. Manage hosted zones and the records that route traffic for your domains."
              actions={
                <SpaceBetween direction="horizontal" size="xs">
                  <Button iconName="refresh" ariaLabel="Refresh dashboard" onClick={() => setReloadKey((key) => key + 1)} />
                  <Button variant="primary" onClick={() => router.push(ROUTES.createHostedZone)}>
                    Create hosted zone
                  </Button>
                </SpaceBetween>
              }
            >
              Route 53 Dashboard
            </Header>
          }
        >
          <SpaceBetween size="l">
            {error && (
              <Alert
                type="error"
                header="The dashboard couldn't be loaded"
                action={<Button onClick={() => setReloadKey((key) => key + 1)}>Retry</Button>}
              >
                {error}
              </Alert>
            )}
            <Grid
              gridDefinition={[
                { colspan: { default: 12, s: 6, l: 3 } },
                { colspan: { default: 12, s: 6, l: 3 } },
                { colspan: { default: 12, s: 6, l: 3 } },
                { colspan: { default: 12, s: 6, l: 3 } },
              ]}
            >
              <Area
                title="DNS management"
                description="Route traffic for your domains with hosted zones and records."
                count={
                  <Link href={ROUTES.hostedZones} onFollow={follow} fontSize="display-l" ariaLabel="Hosted zones">
                    {value(summary?.hosted_zones.total)}
                  </Link>
                }
                unit={
                  summary
                    ? `Hosted zones (${summary.hosted_zones.public} public, ${summary.hosted_zones.private} private) · ${summary.record_count} records`
                    : "Hosted zones"
                }
                footer={
                  <Link href={ROUTES.hostedZones} onFollow={follow}>
                    View hosted zones
                  </Link>
                }
              />
              <Area
                title="Traffic management"
                description="Create traffic policies with traffic flow."
                count={0}
                unit="Traffic policies"
                comingSoon
                footer={
                  <Link href={placeholderHref("trafficpolicies")} onFollow={follow}>
                    Traffic policies
                  </Link>
                }
              />
              <Area
                title="Availability monitoring"
                description="Check the health of your resources."
                count={0}
                unit="Health checks"
                comingSoon
                footer={
                  <Link href={placeholderHref("healthchecks")} onFollow={follow}>
                    Health checks
                  </Link>
                }
              />
              <Area
                title="Domain registration"
                description="Register and manage domain names."
                count={0}
                unit="Registered domains"
                comingSoon
                footer={
                  <Link href={placeholderHref("domains/registered")} onFollow={follow}>
                    Registered domains
                  </Link>
                }
              />
            </Grid>

            <Grid gridDefinition={[{ colspan: { default: 12, m: 8 } }, { colspan: { default: 12, m: 4 } }]}>
              <Table
                variant="container"
                loading={loading}
                loadingText="Loading hosted zones"
                items={summary?.recent_zones ?? []}
                trackBy="id"
                header={
                  <Header
                    variant="h2"
                    actions={
                      <Button onClick={() => router.push(ROUTES.hostedZones)}>View all hosted zones</Button>
                    }
                  >
                    Recently created hosted zones
                  </Header>
                }
                columnDefinitions={[
                  {
                    id: "name",
                    header: "Hosted zone name",
                    isRowHeader: true,
                    cell: (zone) => (
                      <Link href={ROUTES.zone(zone.id)} onFollow={follow}>
                        {zone.name}
                      </Link>
                    ),
                  },
                  { id: "type", header: "Type", cell: (zone) => zoneTypeLabel(zone.type) },
                  { id: "records", header: "Record count", cell: (zone) => zone.record_count },
                  { id: "created", header: "Created", cell: (zone) => formatDateTime(zone.created_at) },
                ]}
                empty={
                  <TableEmptyState
                    title="No hosted zones"
                    subtitle="Create a hosted zone to start routing traffic for your domain."
                    action={<Button onClick={() => router.push(ROUTES.createHostedZone)}>Create hosted zone</Button>}
                  />
                }
              />
              <Table
                variant="container"
                loading={loading}
                loadingText="Loading records"
                items={typeRows}
                trackBy="type"
                header={
                  <Header variant="h2" counter={summary ? `(${summary.record_count})` : undefined}>
                    Records by type
                  </Header>
                }
                columnDefinitions={[
                  { id: "type", header: "Type", isRowHeader: true, cell: (row) => row.type },
                  { id: "count", header: "Records", cell: (row) => row.count },
                ]}
              />
            </Grid>
          </SpaceBetween>
        </ContentLayout>
      }
    />
  );
}
