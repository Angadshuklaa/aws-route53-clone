"use client";

import Button from "@cloudscape-design/components/button";
import CollectionPreferences, {
  type CollectionPreferencesProps,
} from "@cloudscape-design/components/collection-preferences";
import Header from "@cloudscape-design/components/header";
import Link from "@cloudscape-design/components/link";
import Pagination from "@cloudscape-design/components/pagination";
import Select, { type SelectProps } from "@cloudscape-design/components/select";
import SpaceBetween from "@cloudscape-design/components/space-between";
import Table, { type TableProps } from "@cloudscape-design/components/table";
import TextFilter, { type TextFilterProps } from "@cloudscape-design/components/text-filter";
import { useCallback, useState, type RefObject } from "react";

import { TableEmptyState, TableErrorState, TableNoMatchState } from "@/components/common/TableStates";
import { recordsApi, type RecordListParams } from "@/lib/api/endpoints";
import { ALL_RECORD_TYPES } from "@/lib/dns";
import { formatDateTime } from "@/lib/format";
import { useDebouncedValue, usePagedQuery, useStoredState } from "@/lib/hooks";
import type { DnsRecord, HostedZone, RecordType } from "@/lib/types";

type SortField = RecordListParams["sortBy"];

const TYPE_OPTIONS: SelectProps.Option[] = [
  { value: "", label: "All record types" },
  ...ALL_RECORD_TYPES.map((type) => ({ value: type, label: type })),
];

const PAGE_SIZE_OPTIONS = [10, 20, 50, 100].map((value) => ({ value, label: `${value} records` }));

const DEFAULT_PREFERENCES: CollectionPreferencesProps.Preferences = {
  pageSize: 20,
  wrapLines: true,
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

/** Filtering, paging and sorting state for a zone's records, loaded from the API. */
export function useRecordsQuery(zoneId: string) {
  const [filteringText, setFilteringText] = useState("");
  const [typeOption, setTypeOption] = useState<SelectProps.Option>(TYPE_OPTIONS[0]);
  const [page, setPage] = useState(1);
  const [sorting, setSorting] = useState<{ field: SortField; descending: boolean }>({ field: "name", descending: false });
  const [preferences, setPreferences] = useStoredState("r53-records-table", DEFAULT_PREFERENCES);

  const search = useDebouncedValue(filteringText.trim(), 300);
  const pageSize = preferences.pageSize ?? 20;
  const typeKey = typeOption.value ?? "";

  const load = useCallback(
    (signal: AbortSignal) =>
      recordsApi.list(
        zoneId,
        {
          search,
          types: typeKey ? [typeKey as RecordType] : undefined,
          page,
          pageSize,
          sortBy: sorting.field,
          sortOrder: sorting.descending ? "desc" : "asc",
        },
        signal,
      ),
    [zoneId, search, typeKey, page, pageSize, sorting],
  );
  const query = usePagedQuery(load, { onPageOverflow: setPage });

  const resetPage = <T,>(setter: (value: T) => void) => (value: T) => {
    setter(value);
    setPage(1);
  };

  return {
    ...query,
    filteringText,
    setFilteringText: resetPage(setFilteringText),
    typeOption,
    setTypeOption: resetPage(setTypeOption),
    page,
    setPage,
    sorting,
    setSorting: resetPage(setSorting),
    preferences,
    setPreferences: resetPage(setPreferences),
    search,
    filtersActive: Boolean(filteringText || typeKey),
    clearFilters: () => {
      setFilteringText("");
      setTypeOption(TYPE_OPTIONS[0]);
      setPage(1);
    },
  };
}

export type RecordsQuery = ReturnType<typeof useRecordsQuery>;

interface RecordsTableProps {
  zone: HostedZone;
  query: RecordsQuery;
  filterRef: RefObject<TextFilterProps.Ref | null>;
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
          description="Records define how you want to route traffic for the domain and its subdomains."
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
        <div className="filter-bar">
          <div className="filter-bar__text">
            <TextFilter
              ref={filterRef}
              filteringText={query.filteringText}
              onChange={({ detail }) => query.setFilteringText(detail.filteringText)}
              filteringPlaceholder="Filter records by name, type or value"
              filteringAriaLabel="Filter records"
              countText={query.search && data ? `${data.total} ${data.total === 1 ? "match" : "matches"}` : undefined}
            />
          </div>
          <div className="filter-bar__select">
            <Select
              selectedOption={query.typeOption}
              onChange={({ detail }) => query.setTypeOption(detail.selectedOption)}
              options={TYPE_OPTIONS}
              ariaLabel="Filter by record type"
            />
          </div>
          {query.filtersActive && (
            <Button variant="inline-link" onClick={query.clearFilters}>
              Clear filters
            </Button>
          )}
        </div>
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
