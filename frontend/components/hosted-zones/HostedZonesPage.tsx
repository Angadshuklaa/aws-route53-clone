"use client";

import Button from "@cloudscape-design/components/button";
import CollectionPreferences, {
  type CollectionPreferencesProps,
} from "@cloudscape-design/components/collection-preferences";
import Header from "@cloudscape-design/components/header";
import Link from "@cloudscape-design/components/link";
import Pagination from "@cloudscape-design/components/pagination";
import PropertyFilter, { type PropertyFilterProps } from "@cloudscape-design/components/property-filter";
import SpaceBetween from "@cloudscape-design/components/space-between";
import Table, { type TableProps } from "@cloudscape-design/components/table";
import { useRouter } from "next/navigation";
import { useCallback, useRef, useState } from "react";

import { HostedZonesHelp } from "@/components/common/HelpPanels";
import { useFollow } from "@/components/common/navigation";
import { TableEmptyState, TableErrorState, TableNoMatchState } from "@/components/common/TableStates";
import { DeleteHostedZoneModal } from "@/components/hosted-zones/DeleteHostedZoneModal";
import { EditHostedZoneModal } from "@/components/hosted-zones/EditHostedZoneModal";
import { ConsoleLayout } from "@/components/layout/ConsoleLayout";
import { hostedZonesApi, type ZoneListParams } from "@/lib/api/endpoints";
import { formatDateTime, zoneTypeLabel } from "@/lib/format";
import { useHotkeys } from "@/lib/hotkeys";
import { usePagedQuery, useStoredState } from "@/lib/hooks";
import { EMPTY_QUERY, freeTextQuery, tokenValues } from "@/lib/propertyFilter";
import { ROUTES } from "@/lib/routes";
import type { HostedZone, Page, ZoneType } from "@/lib/types";

type SortField = ZoneListParams["sortBy"];

const ZONE_TYPES: ZoneType[] = ["PUBLIC", "PRIVATE"];

const FILTERING_PROPERTIES: PropertyFilterProps.FilteringProperty[] = [
  { key: "name", propertyLabel: "Hosted zone name", groupValuesLabel: "Hosted zone name values", operators: [":"] },
  { key: "type", propertyLabel: "Type", groupValuesLabel: "Type values", operators: ["="] },
];

const FILTERING_OPTIONS: PropertyFilterProps.FilteringOption[] = [
  { propertyKey: "type", value: "Public" },
  { propertyKey: "type", value: "Private" },
];

const PAGE_SIZE_OPTIONS = [10, 20, 50, 100].map((value) => ({ value, label: `${value} hosted zones` }));

const DEFAULT_PREFERENCES: CollectionPreferencesProps.Preferences = {
  pageSize: 10,
  wrapLines: false,
  stripedRows: false,
  contentDisplay: [
    { id: "name", visible: true },
    { id: "type", visible: true },
    { id: "created_by", visible: true },
    { id: "record_count", visible: true },
    { id: "comment", visible: true },
    { id: "id", visible: true },
    { id: "created_at", visible: false },
  ],
};

export function HostedZonesPage({ initialSearch }: { initialSearch: string }) {
  const router = useRouter();
  const follow = useFollow();
  const filterRef = useRef<PropertyFilterProps.Ref>(null);

  const [query, setQuery] = useState<PropertyFilterProps.Query>(() => freeTextQuery(initialSearch));
  const [page, setPage] = useState(1);
  const [sorting, setSorting] = useState<{ field: SortField; descending: boolean }>({ field: "name", descending: false });
  const [preferences, setPreferences] = useStoredState("r53-zones-table", DEFAULT_PREFERENCES);
  const [selected, setSelected] = useState<HostedZone[]>([]);
  const [editing, setEditing] = useState<HostedZone | null>(null);
  const [deleting, setDeleting] = useState<HostedZone | null>(null);
  const [toolsOpen, setToolsOpen] = useState(false);

  const pageSize = preferences.pageSize ?? 10;

  const load = useCallback(
    (signal: AbortSignal): Promise<Page<HostedZone>> => {
      const types = tokenValues(query, "type").map((value) => value.toUpperCase());
      if (types.some((type) => !ZONE_TYPES.includes(type as ZoneType))) {
        return Promise.resolve({ items: [], total: 0, page: 1, page_size: pageSize, total_pages: 1 });
      }
      return hostedZonesApi.list(
        {
          search: tokenValues(query),
          names: tokenValues(query, "name"),
          types: types as ZoneType[],
          page,
          pageSize,
          sortBy: sorting.field,
          sortOrder: sorting.descending ? "desc" : "asc",
        },
        signal,
      );
    },
    [query, page, pageSize, sorting],
  );
  const { data, loading, error, reload } = usePagedQuery(load, { onPageOverflow: setPage });

  const items = data?.items ?? [];
  const selectedZone = selected.length === 1 ? items.find((zone) => zone.id === selected[0].id) : undefined;
  const filtersActive = query.tokens.length > 0;

  const clearFilters = () => {
    setQuery(EMPTY_QUERY);
    setPage(1);
  };

  useHotkeys({
    "/": () => filterRef.current?.focus(),
    c: () => router.push(ROUTES.createHostedZone),
    r: reload,
  });

  const columns: TableProps.ColumnDefinition<HostedZone>[] = [
    {
      id: "name",
      header: "Hosted zone name",
      sortingField: "name",
      isRowHeader: true,
      cell: (zone) => (
        <Link href={ROUTES.zone(zone.id)} onFollow={follow}>
          {zone.name}
        </Link>
      ),
    },
    { id: "type", header: "Type", sortingField: "type", cell: (zone) => zoneTypeLabel(zone.type) },
    { id: "created_by", header: "Created by", cell: () => "Route 53" },
    { id: "record_count", header: "Record count", sortingField: "record_count", cell: (zone) => zone.record_count },
    { id: "comment", header: "Description", cell: (zone) => zone.comment || "-" },
    { id: "id", header: "Hosted zone ID", cell: (zone) => zone.id },
    { id: "created_at", header: "Created", sortingField: "created_at", cell: (zone) => formatDateTime(zone.created_at) },
  ];

  const emptyState = error ? (
    <TableErrorState message={error} onRetry={reload} />
  ) : filtersActive ? (
    <TableNoMatchState onClearFilter={clearFilters} />
  ) : (
    <TableEmptyState
      title="No hosted zones"
      subtitle="You don't have any hosted zones yet."
      action={<Button onClick={() => router.push(ROUTES.createHostedZone)}>Create hosted zone</Button>}
    />
  );

  return (
    <ConsoleLayout
      breadcrumbs={[
        { text: "Route 53", href: ROUTES.dashboard },
        { text: "Hosted zones", href: ROUTES.hostedZones },
      ]}
      contentType="table"
      tools={<HostedZonesHelp />}
      toolsOpen={toolsOpen}
      onToolsChange={setToolsOpen}
      content={
        <>
          <Table
            variant="full-page"
            stickyHeader
            enableKeyboardNavigation
            items={error ? [] : items}
            loading={loading}
            loadingText="Loading hosted zones"
            trackBy="id"
            columnDefinitions={columns}
            columnDisplay={preferences.contentDisplay}
            wrapLines={preferences.wrapLines}
            stripedRows={preferences.stripedRows}
            selectionType="single"
            selectedItems={selectedZone ? [selectedZone] : []}
            onSelectionChange={({ detail }) => setSelected(detail.selectedItems)}
            sortingColumn={{ sortingField: sorting.field }}
            sortingDescending={sorting.descending}
            onSortingChange={({ detail }) => {
              setSorting({ field: (detail.sortingColumn.sortingField ?? "name") as SortField, descending: detail.isDescending ?? false });
              setPage(1);
            }}
            ariaLabels={{
              selectionGroupLabel: "Hosted zone selection",
              itemSelectionLabel: (_, zone) => `Select ${zone.name}`,
              allItemsSelectionLabel: () => "Select all",
            }}
            empty={emptyState}
            header={
              <Header
                variant="awsui-h1-sticky"
                counter={data ? `(${data.total})` : undefined}
                info={
                  <Link variant="info" onFollow={() => setToolsOpen(true)}>
                    Info
                  </Link>
                }
                actions={
                  <SpaceBetween direction="horizontal" size="xs">
                    <Button iconName="refresh" ariaLabel="Refresh hosted zones" onClick={reload} />
                    <Button disabled={!selectedZone} onClick={() => selectedZone && router.push(ROUTES.zone(selectedZone.id))}>
                      View details
                    </Button>
                    <Button disabled={!selectedZone} onClick={() => setEditing(selectedZone ?? null)}>
                      Edit
                    </Button>
                    <Button disabled={!selectedZone} onClick={() => setDeleting(selectedZone ?? null)}>
                      Delete
                    </Button>
                    <Button variant="primary" onClick={() => router.push(ROUTES.createHostedZone)}>
                      Create hosted zone
                    </Button>
                  </SpaceBetween>
                }
              >
                Hosted zones
              </Header>
            }
            filter={
              <PropertyFilter
                ref={filterRef}
                query={query}
                onChange={({ detail }) => {
                  setQuery(detail);
                  setPage(1);
                }}
                filteringProperties={FILTERING_PROPERTIES}
                filteringOptions={FILTERING_OPTIONS}
                filteringPlaceholder="Filter hosted zones by property or value"
                filteringAriaLabel="Filter hosted zones"
                countText={filtersActive && data ? `${data.total} ${data.total === 1 ? "match" : "matches"}` : undefined}
                hideOperations
                expandToViewport
              />
            }
            pagination={
              <Pagination
                currentPageIndex={page}
                pagesCount={data?.total_pages ?? 1}
                onChange={({ detail }) => setPage(detail.currentPageIndex)}
                disabled={loading}
              />
            }
            preferences={
              <CollectionPreferences
                title="Preferences"
                confirmLabel="Confirm"
                cancelLabel="Cancel"
                preferences={preferences}
                onConfirm={({ detail }) => {
                  setPreferences(detail);
                  setPage(1);
                }}
                pageSizePreference={{ title: "Page size", options: PAGE_SIZE_OPTIONS }}
                wrapLinesPreference={{}}
                stripedRowsPreference={{}}
                contentDisplayPreference={{
                  title: "Column preferences",
                  options: columns.map((column) => ({
                    id: column.id!,
                    label: String(column.header),
                    alwaysVisible: column.id === "name",
                  })),
                }}
              />
            }
          />
          {editing && (
            <EditHostedZoneModal
              zone={editing}
              onDismiss={() => setEditing(null)}
              onSaved={() => {
                setEditing(null);
                reload();
              }}
            />
          )}
          {deleting && (
            <DeleteHostedZoneModal
              zone={deleting}
              onDismiss={() => setDeleting(null)}
              onDeleted={() => {
                setDeleting(null);
                setSelected([]);
                reload();
              }}
            />
          )}
        </>
      }
    />
  );
}
