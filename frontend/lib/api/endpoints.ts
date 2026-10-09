import { apiDownload, apiRequest } from "@/lib/api/client";
import type {
  BulkDeleteResult,
  CurrentUser,
  DnsRecord,
  HostedZone,
  HostedZoneInput,
  HostedZoneUpdateInput,
  Page,
  RecordInput,
  RecordType,
  SortOrder,
  ZoneImportResult,
  ZoneType,
} from "@/lib/types";

export const authApi = {
  login: (credentials: { account_id: string; username: string; password: string }) =>
    apiRequest<CurrentUser>("/api/auth/login", { method: "POST", body: credentials }),
  logout: () => apiRequest<void>("/api/auth/logout", { method: "POST" }),
  me: (signal?: AbortSignal) => apiRequest<CurrentUser>("/api/auth/me", { signal }),
};

export interface ZoneListParams {
  search?: string;
  type?: ZoneType;
  page: number;
  pageSize: number;
  sortBy: "name" | "type" | "record_count" | "created_at";
  sortOrder: SortOrder;
}

const zonePath = (zoneId: string) => `/api/hosted-zones/${encodeURIComponent(zoneId)}`;

export const hostedZonesApi = {
  list: (params: ZoneListParams, signal?: AbortSignal) =>
    apiRequest<Page<HostedZone>>("/api/hosted-zones", {
      signal,
      query: {
        search: params.search,
        type: params.type,
        page: params.page,
        page_size: params.pageSize,
        sort_by: params.sortBy,
        sort_order: params.sortOrder,
      },
    }),
  get: (zoneId: string, signal?: AbortSignal) => apiRequest<HostedZone>(zonePath(zoneId), { signal }),
  create: (input: HostedZoneInput) => apiRequest<HostedZone>("/api/hosted-zones", { method: "POST", body: input }),
  update: (zoneId: string, input: HostedZoneUpdateInput) =>
    apiRequest<HostedZone>(zonePath(zoneId), { method: "PUT", body: input }),
  remove: (zoneId: string) => apiRequest<void>(zonePath(zoneId), { method: "DELETE" }),
  export: (zoneId: string, format: "bind" | "json") => apiDownload(`${zonePath(zoneId)}/export`, { format }),
  importZoneFile: (zoneId: string, content: string, overwrite: boolean) =>
    apiRequest<ZoneImportResult>(`${zonePath(zoneId)}/import`, { method: "POST", body: { content, overwrite } }),
};

export interface RecordListParams {
  search?: string;
  types?: RecordType[];
  page: number;
  pageSize: number;
  sortBy: "name" | "type" | "ttl";
  sortOrder: SortOrder;
}

const recordsPath = (zoneId: string) => `${zonePath(zoneId)}/records`;

export const recordsApi = {
  list: (zoneId: string, params: RecordListParams, signal?: AbortSignal) =>
    apiRequest<Page<DnsRecord>>(recordsPath(zoneId), {
      signal,
      query: {
        search: params.search,
        type: params.types,
        page: params.page,
        page_size: params.pageSize,
        sort_by: params.sortBy,
        sort_order: params.sortOrder,
      },
    }),
  create: (zoneId: string, input: RecordInput) =>
    apiRequest<DnsRecord>(recordsPath(zoneId), { method: "POST", body: input }),
  update: (zoneId: string, recordId: number, input: RecordInput) =>
    apiRequest<DnsRecord>(`${recordsPath(zoneId)}/${recordId}`, { method: "PUT", body: input }),
  remove: (zoneId: string, recordId: number) =>
    apiRequest<void>(`${recordsPath(zoneId)}/${recordId}`, { method: "DELETE" }),
  bulkRemove: (zoneId: string, recordIds: number[]) =>
    apiRequest<BulkDeleteResult>(`${recordsPath(zoneId)}/batch-delete`, {
      method: "POST",
      body: { record_ids: recordIds },
    }),
};
