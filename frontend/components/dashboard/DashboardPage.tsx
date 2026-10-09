"use client";

import Alert from "@cloudscape-design/components/alert";
import Box from "@cloudscape-design/components/box";
import Button from "@cloudscape-design/components/button";
import ColumnLayout from "@cloudscape-design/components/column-layout";
import Container from "@cloudscape-design/components/container";
import ContentLayout from "@cloudscape-design/components/content-layout";
import Grid from "@cloudscape-design/components/grid";
import Header from "@cloudscape-design/components/header";
import HelpPanel from "@cloudscape-design/components/help-panel";
import KeyValuePairs from "@cloudscape-design/components/key-value-pairs";
import Link from "@cloudscape-design/components/link";
import SpaceBetween from "@cloudscape-design/components/space-between";
import StatusIndicator from "@cloudscape-design/components/status-indicator";
import Table from "@cloudscape-design/components/table";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

import { useFollow } from "@/components/common/navigation";
import { TableEmptyState } from "@/components/common/TableStates";
import { ConsoleLayout } from "@/components/layout/ConsoleLayout";
import { errorMessage, isAbortError } from "@/lib/api/client";
import { dashboardApi, healthApi } from "@/lib/api/endpoints";
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

interface CounterProps {
  label: string;
  value: number | string;
  href: string;
  note: string;
  follow: ReturnType<typeof useFollow>;
}

function Counter({ label, value, href, note, follow }: CounterProps) {
  return (
    <div>
      <Box variant="awsui-key-label">{label}</Box>
      <Link variant="awsui-value-large" href={href} onFollow={follow} ariaLabel={`${label}: ${value}`}>
        {value}
      </Link>
      <Box variant="small" color="text-body-secondary" display="block">
        {note}
      </Box>
    </div>
  );
}

export function DashboardPage() {
  const router = useRouter();
  const follow = useFollow();
  const [summary, setSummary] = useState<DashboardSummary | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);
  const [toolsOpen, setToolsOpen] = useState(false);
  const [health, setHealth] = useState<"checking" | "ok" | "degraded">("checking");

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
    healthApi.check(controller.signal).then(
      (result) => setHealth(result.status === "ok" ? "ok" : "degraded"),
      (err: unknown) => {
        if (!isAbortError(err)) setHealth("degraded");
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
              actions={
                <Button variant="primary" onClick={() => router.push(ROUTES.createHostedZone)}>
                  Create hosted zone
                </Button>
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
            <Grid gridDefinition={[{ colspan: { default: 12, m: 8 } }, { colspan: { default: 12, m: 4 } }]}>
              <Container
                fitHeight
                header={
                  <Header variant="h2" description="Route 53 is a global service.">
                    Service overview
                  </Header>
                }
              >
                <ColumnLayout columns={4} variant="text-grid" minColumnWidth={130}>
                  <Counter
                    label="Hosted zones"
                    value={value(summary?.hosted_zones.total)}
                    href={ROUTES.hostedZones}
                    note={summary ? `${summary.hosted_zones.public} public, ${summary.hosted_zones.private} private` : "DNS management"}
                    follow={follow}
                  />
                  <Counter label="Traffic policies" value={0} href={placeholderHref("trafficpolicies")} note="Coming soon" follow={follow} />
                  <Counter label="Health checks" value={0} href={placeholderHref("healthchecks")} note="Coming soon" follow={follow} />
                  <Counter
                    label="Registered domains"
                    value={0}
                    href={placeholderHref("domains/registered")}
                    note="Coming soon"
                    follow={follow}
                  />
                </ColumnLayout>
              </Container>
              <Container fitHeight header={<Header variant="h2">Service health</Header>}>
                <KeyValuePairs
                  columns={1}
                  items={[
                    { label: "Region", value: "Global" },
                    {
                      label: "Status",
                      value:
                        health === "checking" ? (
                          <StatusIndicator type="loading">Checking</StatusIndicator>
                        ) : health === "ok" ? (
                          <StatusIndicator type="success">Service is operating normally</StatusIndicator>
                        ) : (
                          <StatusIndicator type="error">Service is unavailable</StatusIndicator>
                        ),
                    },
                  ]}
                />
              </Container>
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
