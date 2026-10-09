"use client";

import Alert from "@cloudscape-design/components/alert";
import Box from "@cloudscape-design/components/box";
import Button from "@cloudscape-design/components/button";
import ButtonDropdown from "@cloudscape-design/components/button-dropdown";
import ContentLayout from "@cloudscape-design/components/content-layout";
import CopyToClipboard from "@cloudscape-design/components/copy-to-clipboard";
import ExpandableSection from "@cloudscape-design/components/expandable-section";
import Header from "@cloudscape-design/components/header";
import KeyValuePairs from "@cloudscape-design/components/key-value-pairs";
import SpaceBetween from "@cloudscape-design/components/space-between";
import Spinner from "@cloudscape-design/components/spinner";
import Table from "@cloudscape-design/components/table";
import Tabs from "@cloudscape-design/components/tabs";
import type { TextFilterProps } from "@cloudscape-design/components/text-filter";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";

import { RecordsHelp } from "@/components/common/HelpPanels";
import { TableEmptyState } from "@/components/common/TableStates";
import { DeleteHostedZoneModal } from "@/components/hosted-zones/DeleteHostedZoneModal";
import { EditHostedZoneModal } from "@/components/hosted-zones/EditHostedZoneModal";
import { ConsoleLayout } from "@/components/layout/ConsoleLayout";
import { DeleteRecordsModal } from "@/components/records/DeleteRecordsModal";
import { ImportZoneFileModal } from "@/components/records/ImportZoneFileModal";
import { RecordDetailsPanel } from "@/components/records/RecordDetailsPanel";
import { RecordFormModal } from "@/components/records/RecordFormModal";
import { RecordsTable, useRecordsQuery } from "@/components/records/RecordsTable";
import { ApiError, errorMessage, isAbortError } from "@/lib/api/client";
import { hostedZonesApi } from "@/lib/api/endpoints";
import { formatDateTime, regionLabel, zoneTypeLabel } from "@/lib/format";
import { useHotkeys } from "@/lib/hotkeys";
import { useNotifications } from "@/lib/notifications";
import { ROUTES } from "@/lib/routes";
import type { DnsRecord, HostedZone } from "@/lib/types";

type Dialog =
  | { kind: "create-record" }
  | { kind: "edit-record"; record: DnsRecord }
  | { kind: "delete-records"; records: DnsRecord[] }
  | { kind: "import" }
  | { kind: "edit-zone" }
  | { kind: "delete-zone" };

type ZoneState = { status: "loading" } | { status: "ready"; zone: HostedZone } | { status: "error"; message: string; notFound: boolean };

function ZoneDetails({ zone, onEdit }: { zone: HostedZone; onEdit: () => void }) {
  return (
    <ExpandableSection
      variant="container"
      defaultExpanded
      headerText="Hosted zone details"
      headerActions={<Button onClick={onEdit}>Edit hosted zone</Button>}
    >
      <KeyValuePairs
        columns={3}
        items={[
          {
            label: "Hosted zone name",
            value: (
              <CopyToClipboard
                variant="inline"
                textToCopy={zone.name}
                copyButtonAriaLabel="Copy hosted zone name"
                copySuccessText="Hosted zone name copied"
                copyErrorText="Hosted zone name failed to copy"
              />
            ),
          },
          {
            label: "Hosted zone ID",
            value: (
              <CopyToClipboard
                variant="inline"
                textToCopy={zone.id}
                copyButtonAriaLabel="Copy hosted zone ID"
                copySuccessText="Hosted zone ID copied"
                copyErrorText="Hosted zone ID failed to copy"
              />
            ),
          },
          { label: "Description", value: zone.comment || "-" },
          { label: "Type", value: `${zoneTypeLabel(zone.type)} hosted zone` },
          { label: "Record count", value: zone.record_count },
          { label: "Created", value: formatDateTime(zone.created_at) },
          {
            label: "Name servers",
            value: zone.name_servers.length ? (
              <ul className="value-lines">
                {zone.name_servers.map((server) => (
                  <li key={server}>{server}</li>
                ))}
              </ul>
            ) : (
              "-"
            ),
          },
          ...(zone.type === "PRIVATE"
            ? [{ label: "Associated VPC", value: `${zone.vpc_id} (${regionLabel(zone.vpc_region)})` }]
            : []),
          { label: "Last updated", value: formatDateTime(zone.updated_at) },
        ]}
      />
    </ExpandableSection>
  );
}

export function HostedZoneDetailPage({ zoneId }: { zoneId: string }) {
  const router = useRouter();
  const { notify } = useNotifications();
  const [zoneState, setZoneState] = useState<ZoneState>({ status: "loading" });
  const [zoneReloadKey, setZoneReloadKey] = useState(0);
  const [activeTab, setActiveTab] = useState("records");
  const [selected, setSelected] = useState<DnsRecord[]>([]);
  const [dialog, setDialog] = useState<Dialog | null>(null);
  const [splitPanelOpen, setSplitPanelOpen] = useState(true);
  const [toolsOpen, setToolsOpen] = useState(false);
  const filterRef = useRef<TextFilterProps.Ref>(null);
  const records = useRecordsQuery(zoneId);

  useEffect(() => {
    const controller = new AbortController();
    hostedZonesApi.get(zoneId, controller.signal).then(
      (zone) => setZoneState({ status: "ready", zone }),
      (error: unknown) => {
        if (isAbortError(error)) return;
        setZoneState({
          status: "error",
          message: errorMessage(error),
          notFound: error instanceof ApiError && error.status === 404,
        });
      },
    );
    return () => controller.abort();
  }, [zoneId, zoneReloadKey]);

  const zone = zoneState.status === "ready" ? zoneState.zone : null;

  // Keep the selection in sync with the freshly loaded page of records.
  const pageItems = records.data?.items ?? [];
  const selectedOnPage = selected
    .map((record) => pageItems.find((item) => item.id === record.id))
    .filter((record): record is DnsRecord => Boolean(record));
  const singleSelected = selectedOnPage.length === 1 ? selectedOnPage[0] : undefined;

  const refreshAll = () => {
    records.reload();
    setZoneReloadKey((key) => key + 1);
  };

  useHotkeys(
    {
      "/": () => filterRef.current?.focus(),
      c: () => setDialog({ kind: "create-record" }),
      r: refreshAll,
    },
    Boolean(zone) && activeTab === "records",
  );

  const exportZone = async (format: "bind" | "json") => {
    if (!zone) return;
    try {
      await hostedZonesApi.export(zone.id, format);
      notify({ type: "success", content: `Exported ${zone.name} as ${format === "bind" ? "a BIND zone file" : "JSON"}.` });
    } catch (error) {
      notify({ type: "error", header: "Export failed", content: errorMessage(error) });
    }
  };

  const breadcrumbs = [
    { text: "Route 53", href: ROUTES.dashboard },
    { text: "Hosted zones", href: ROUTES.hostedZones },
    { text: zone?.name ?? zoneId, href: ROUTES.zone(zoneId) },
  ];

  if (zoneState.status === "loading") {
    return (
      <ConsoleLayout
        breadcrumbs={breadcrumbs}
        content={
          <Box textAlign="center" padding="xxl">
            <Spinner size="large" /> <Box variant="span">Loading hosted zone</Box>
          </Box>
        }
      />
    );
  }

  if (zoneState.status === "error" || !zone) {
    const notFound = zoneState.status === "error" && zoneState.notFound;
    return (
      <ConsoleLayout
        breadcrumbs={breadcrumbs}
        content={
          <ContentLayout header={<Header variant="h1">{notFound ? "Hosted zone not found" : "Error"}</Header>}>
            <Alert
              type="error"
              header={notFound ? "This hosted zone doesn't exist" : "The hosted zone couldn't be loaded"}
              action={
                notFound ? (
                  <Button onClick={() => router.push(ROUTES.hostedZones)}>Go to Hosted zones</Button>
                ) : (
                  <Button onClick={() => setZoneReloadKey((key) => key + 1)}>Retry</Button>
                )
              }
            >
              {zoneState.status === "error" ? zoneState.message : null}
            </Alert>
          </ContentLayout>
        }
      />
    );
  }

  return (
    <ConsoleLayout
      breadcrumbs={breadcrumbs}
      tools={<RecordsHelp />}
      toolsOpen={toolsOpen}
      onToolsChange={setToolsOpen}
      splitPanel={
        activeTab === "records" && singleSelected ? (
          <RecordDetailsPanel
            record={singleSelected}
            onEdit={() => setDialog({ kind: "edit-record", record: singleSelected })}
            onDelete={() => setDialog({ kind: "delete-records", records: [singleSelected] })}
          />
        ) : undefined
      }
      splitPanelOpen={splitPanelOpen}
      onSplitPanelToggle={setSplitPanelOpen}
      content={
        <ContentLayout
          header={
            <Header
              variant="h1"
              description={zone.comment || undefined}
              actions={
                <SpaceBetween direction="horizontal" size="xs">
                  <Button onClick={() => setDialog({ kind: "delete-zone" })}>Delete zone</Button>
                  <ButtonDropdown
                    items={[
                      { id: "bind", text: "BIND zone file (.zone)", iconName: "download" },
                      { id: "json", text: "JSON (.json)", iconName: "download" },
                    ]}
                    onItemClick={({ detail }) => void exportZone(detail.id as "bind" | "json")}
                  >
                    Export zone file
                  </ButtonDropdown>
                </SpaceBetween>
              }
            >
              {zone.name}
            </Header>
          }
        >
          <SpaceBetween size="l">
            <ZoneDetails zone={zone} onEdit={() => setDialog({ kind: "edit-zone" })} />
            <Tabs
              activeTabId={activeTab}
              onChange={({ detail }) => setActiveTab(detail.activeTabId)}
              tabs={[
                {
                  id: "records",
                  label: `Records (${zone.record_count})`,
                  content: (
                    <RecordsTable
                      zone={zone}
                      query={records}
                      filterRef={filterRef}
                      selected={selectedOnPage}
                      onSelectionChange={(items) => {
                        setSelected(items);
                        if (items.length === 1) setSplitPanelOpen(true);
                      }}
                      onCreate={() => setDialog({ kind: "create-record" })}
                      onEdit={(record) => setDialog({ kind: "edit-record", record })}
                      onDelete={(items) => setDialog({ kind: "delete-records", records: items })}
                      onImport={() => setDialog({ kind: "import" })}
                      onInfo={() => setToolsOpen(true)}
                    />
                  ),
                },
                {
                  id: "tags",
                  label: `Hosted zone tags (${zone.tags.length})`,
                  content: (
                    <Table
                      variant="container"
                      items={zone.tags}
                      trackBy="key"
                      columnDefinitions={[
                        { id: "key", header: "Key", cell: (tag) => tag.key, isRowHeader: true },
                        { id: "value", header: "Value", cell: (tag) => tag.value || "-" },
                      ]}
                      header={
                        <Header
                          variant="h2"
                          counter={`(${zone.tags.length})`}
                          actions={<Button onClick={() => setDialog({ kind: "edit-zone" })}>Manage tags</Button>}
                        >
                          Tags
                        </Header>
                      }
                      empty={
                        <TableEmptyState
                          title="No tags"
                          subtitle="No tags are associated with this hosted zone."
                          action={<Button onClick={() => setDialog({ kind: "edit-zone" })}>Manage tags</Button>}
                        />
                      }
                    />
                  ),
                },
              ]}
            />
          </SpaceBetween>

          {dialog?.kind === "create-record" && (
            <RecordFormModal
              zone={zone}
              onDismiss={() => setDialog(null)}
              onSaved={() => {
                setDialog(null);
                refreshAll();
              }}
            />
          )}
          {dialog?.kind === "edit-record" && (
            <RecordFormModal
              zone={zone}
              record={dialog.record}
              onDismiss={() => setDialog(null)}
              onSaved={() => {
                setDialog(null);
                refreshAll();
              }}
            />
          )}
          {dialog?.kind === "delete-records" && (
            <DeleteRecordsModal
              zone={zone}
              records={dialog.records}
              onDismiss={() => setDialog(null)}
              onDeleted={(deletedIds) => {
                setDialog(null);
                setSelected((current) => current.filter((record) => !deletedIds.includes(record.id)));
                refreshAll();
              }}
            />
          )}
          {dialog?.kind === "import" && (
            <ImportZoneFileModal zone={zone} onDismiss={() => setDialog(null)} onImported={refreshAll} />
          )}
          {dialog?.kind === "edit-zone" && (
            <EditHostedZoneModal
              zone={zone}
              onDismiss={() => setDialog(null)}
              onSaved={(updated) => {
                setDialog(null);
                setZoneState({ status: "ready", zone: updated });
              }}
            />
          )}
          {dialog?.kind === "delete-zone" && (
            <DeleteHostedZoneModal
              zone={zone}
              onDismiss={() => setDialog(null)}
              onDeleted={() => router.push(ROUTES.hostedZones)}
            />
          )}
        </ContentLayout>
      }
    />
  );
}
