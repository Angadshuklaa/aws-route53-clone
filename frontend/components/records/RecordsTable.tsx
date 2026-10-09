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
import { useCallback, useState, type RefObject } from "react";

import { TableEmptyState, TableErrorState, TableNoMatchState } from "@/components/common/TableStates";
import { recordsApi, type RecordListParams } from "@/lib/api/endpoints";
import { ALL_RECORD_TYPES } from "@/lib/dns";
import { formatDateTime } from "@/lib/format";
import { usePagedQuery, useStoredState } from "@/lib/hooks";
import { EMPTY_QUERY, tokenValues } from "@/lib/propertyFilter";
import type { DnsRecord, HostedZone, Page, RecordType } from "@/lib/types";

type SortField = RecordListParams["sortBy"];

const ROUTING_POLICIES = ["Simple", "Weighted", "Latency", "Failover", "Geolocation", "Geoproximity", "IP-based", "Multivalue answer"];

const FILTERING_PROPERTIES: PropertyFilterProps.FilteringProperty[] = [
  { key: "name", propertyLabel: "Record name", groupValuesLabel: "Record name values", operators: [":"] },
  { key: "type", propertyLabel: "Record type", groupValuesLabel: "Record type values", operators: ["="] },
  { key: "value", propertyLabel: "Value/Route traffic to", groupValuesLabel: "Values", operators: [":"] },
  { key: "routingPolicy", propertyLabel: "Routing policy", groupValuesLabel: "Routing policy values", operators: ["="] },
  { key: "alias", propertyLabel: "Alias", groupValuesLabel: "Alias values", operators: ["="] },
];

const FILTERING_OPTIONS: PropertyFilterProps.FilteringOption[] = [
  ...ALL_RECORD_TYPES.map((type) => ({ propertyKey: "type", value: type })),
  ...ROUTING_POLICIES.map((policy) => ({ propertyKey: "routingPolicy", value: policy })),
  { propertyKey: "alias", value: "Yes" },
  { propertyKey: "alias", value: "No" },
];

const emptyPage = (pageSize: number): Page<DnsRecord> => ({ items: [], total: 0, page: 1, page_size: pageSize, total_pages: 1 });

const PAGE_SIZE_OPTIONS = [10, 20, 50, 100].map((value) => ({ value, label: `${value} records` }));

const DEFAULT_PREFERENCES: CollectionPreferencesProps.Preferences = {
  pageSize: 20,
  wrapLines: false,
  stripedRows: false,
  contentDisplay: [
    { id: "name", visible: true },
    { id: "type", visible: true },
    { id: "routing", visible: true },
    { id: "alias", visible: true },
    { id: "value", visible: true },
    { id: "ttl", visible: true },
    { id: "id", visible: false },
    { id: "updated_at", visible: false },
  ],
};

export function useRecordsQuery(zoneId: string) {
  const [filterQuery, setFilterQuery] = useState<PropertyFilterProps.Query>(EMPTY_QUERY);
  const [page, setPage] = useState(1);
  const [sorting, setSorting] = useState<{ field: SortField; descending: boolean }>({ field: "name", descending: false });
  const [preferences, setPreferences] = useStoredState("r53-records-table", DEFAULT_PREFERENCES);

  const pageSize = preferences.pageSize ?? 20;

  const load = useCallback(
    (signal: AbortSignal): Promise<Page<DnsRecord>> => {
      const types = tokenValues(filterQuery, "type").map((value) => value.toUpperCase());
      const aliasValues = tokenValues(filterQuery, "alias").map((value) => value.toLowerCase());
      if (types.some((type) => !ALL_RECORD_TYPES.includes(type as RecordType)) || aliasValues.some((v) => !["yes", "no"].includes(v))) {
        return Promise.resolve(emptyPage(pageSize));
      }
      return recordsApi.list(
        zoneId,
        {
          search: tokenValues(filterQuery),
          names: tokenValues(filterQuery, "name"),
          values: tokenValues(filterQuery, "value"),
          types: types as RecordType[],
          routingPolicies: tokenValues(filterQuery, "routingPolicy").map((policy) => policy.toUpperCase().replace(/[^A-Z]/g, "_")),
          alias: aliasValues.length ? aliasValues.includes("yes") : undefined,
          page,
          pageSize,
          sortBy: sorting.field,
          sortOrder: sorting.descending ? "desc" : "asc",
        },
        signal,
      );
    },
    [zoneId, filterQuery, page, pageSize, sorting],
  );
  const query = usePagedQuery(load, { onPageOverflow: setPage });

  const resetPage = <T,>(setter: (value: T) => void) => (value: T) => {
    setter(value);
    setPage(1);
  };

  return {
    ...query,
    filterQuery,
    setFilterQuery: resetPage(setFilterQuery),
    page,
    setPage,
    sorting,
    setSorting: resetPage(setSorting),
    preferences,
    setPreferences: resetPage(setPreferences),
    filtersActive: filterQuery.tokens.length > 0,
    clearFilters: () => {
      setFilterQuery(EMPTY_QUERY);
      setPage(1);
    },
  };
}

export type RecordsQuery = ReturnType<typeof useRecordsQuery>;

interface RecordsTableProps {
  zone: HostedZone;
  query: RecordsQuery;
  filterRef: RefObject<PropertyFilterProps.Ref | null>;
  selected: DnsRecord[];
  onSelectionChange: (records: DnsRecord[]) => void;
  onCreate: () => void;
  onEdit: (record: DnsRecord) => void;
  onDelete: (records: DnsRecord[]) => void;
  onImport: () => void;
  onInfo: () => void;
}

function ValueLines({ values }: { values: string[] }) {
  return (
    <ul className="value-lines">
      {values.map((value, index) => (
        <li key={index}>{value}</li>
      ))}
    </ul>
  );
}

export function RecordsTable({
  zone,
  query,
  filterRef,
  selected,
  onSelectionChange,
  onCreate,
  onEdit,
  onDelete,
  onImport,
  onInfo,
}: RecordsTableProps) {
  const { data, loading, error, reload, preferences } = query;
  const items = data?.items ?? [];

  const columns: TableProps.ColumnDefinition<DnsRecord>[] = [
    {
      id: "name",
      header: "Record name",
      sortingField: "name",
      isRowHeader: true,
      cell: (record) => (
        <Link onFollow={() => onEdit(record)} ariaLabel={`Edit ${record.name} ${record.type}`}>
          {record.name}
        </Link>
      ),
    },
    { id: "type", header: "Type", sortingField: "type", cell: (record) => record.type },
    { id: "routing", header: "Routing policy", cell: () => "Simple" },
    { id: "alias", header: "Alias", cell: () => "No" },
    { id: "value", header: "Value/Route traffic to", cell: (record) => <ValueLines values={record.formatted_values} /> },
    { id: "ttl", header: "TTL (seconds)", sortingField: "ttl", cell: (record) => record.ttl },
    { id: "id", header: "Record ID", cell: (record) => record.id },
    { id: "updated_at", header: "Last updated", cell: (record) => formatDateTime(record.updated_at) },
  ];

  const emptyState = error ? (
    <TableErrorState message={error} onRetry={reload} />
  ) : query.filtersActive ? (
    <TableNoMatchState onClearFilter={query.clearFilters} />
  ) : (
    <TableEmptyState
      title="No records"
      subtitle={`${zone.name} doesn't have any records.`}
      action={<Button onClick={onCreate}>Create record</Button>}
    />
  );

  const single = selected.length === 1 ? selected[0] : undefined;
  const anyDeletable = selected.some((record) => !record.is_system);

  return (
    <Table
      variant="container"
      enableKeyboardNavigation
      items={error ? [] : items}
      loading={loading}
      loadingText="Loading records"
      trackBy="id"
      columnDefinitions={columns}
      columnDisplay={preferences.contentDisplay}
      wrapLines={preferences.wrapLines}
      stripedRows={preferences.stripedRows}
      selectionType="multi"
      selectedItems={selected}
      onSelectionChange={({ detail }) => onSelectionChange(detail.selectedItems)}
      sortingColumn={{ sortingField: query.sorting.field }}
      sortingDescending={query.sorting.descending}
      onSortingChange={({ detail }) =>
        query.setSorting({ field: (detail.sortingColumn.sortingField ?? "name") as SortField, descending: detail.isDescending ?? false })
      }
      ariaLabels={{
        selectionGroupLabel: "Record selection",
        itemSelectionLabel: (_, record) => `Select ${record.name} ${record.type}`,
        allItemsSelectionLabel: () => "Select all records on this page",
      }}
      empty={emptyState}
      header={
        <Header
          variant="h2"
          counter={data ? (selected.length ? `(${selected.length}/${data.total})` : `(${data.total})`) : undefined}
          info={
            <Link variant="info" onFollow={onInfo}>
              Info
            </Link>
          }
          actions={
            <SpaceBetween direction="horizontal" size="xs">
              <Button iconName="refresh" ariaLabel="Refresh records" onClick={reload} />
              <Button disabled={!single} onClick={() => single && onEdit(single)}>
                Edit record
              </Button>
              <Button disabled={!anyDeletable} onClick={() => onDelete(selected)}>
                Delete record{selected.length > 1 ? "s" : ""}
              </Button>
              <Button onClick={onImport}>Import zone file</Button>
              <Button variant="primary" onClick={onCreate}>
                Create record
              </Button>
            </SpaceBetween>
          }
        >
          Records
        </Header>
      }
      filter={
        <PropertyFilter
          ref={filterRef}
          query={query.filterQuery}
          onChange={({ detail }) => query.setFilterQuery(detail)}
          filteringProperties={FILTERING_PROPERTIES}
          filteringOptions={FILTERING_OPTIONS}
          filteringPlaceholder="Filter records by property or value"
          filteringAriaLabel="Filter records"
          countText={query.filtersActive && data ? `${data.total} ${data.total === 1 ? "match" : "matches"}` : undefined}
          hideOperations
          expandToViewport
        />
      }
      pagination={
        <Pagination
          currentPageIndex={query.page}
          pagesCount={data?.total_pages ?? 1}
          onChange={({ detail }) => query.setPage(detail.currentPageIndex)}
          disabled={loading}
        />
      }
      preferences={
        <CollectionPreferences
          title="Preferences"
          confirmLabel="Confirm"
          cancelLabel="Cancel"
          preferences={preferences}
          onConfirm={({ detail }) => query.setPreferences(detail)}
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
  );
}
