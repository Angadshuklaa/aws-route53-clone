export type ZoneType = "PUBLIC" | "PRIVATE";

export interface Tag {
  key: string;
  value: string;
}

export interface HostedZone {
  id: string;
  name: string;
  type: ZoneType;
  comment: string;
  vpc_id: string | null;
  vpc_region: string | null;
  record_count: number;
  name_servers: string[];
  tags: Tag[];
  created_at: string;
  updated_at: string;
}

export interface HostedZoneInput {
  name: string;
  type: ZoneType;
  comment: string;
  vpc_id: string | null;
  vpc_region: string | null;
  tags: Tag[];
}

export type HostedZoneUpdateInput = Omit<HostedZoneInput, "name" | "type">;

export type CreatableRecordType = "A" | "AAAA" | "CAA" | "CNAME" | "MX" | "NS" | "PTR" | "SRV" | "TXT";
export type RecordType = CreatableRecordType | "SOA";

export interface RecordValue {
  value: string;
  priority: number | null;
  weight: number | null;
  port: number | null;
  flags: number | null;
  tag: string | null;
}

export interface DnsRecord {
  id: number;
  zone_id: string;
  name: string;
  type: RecordType;
  ttl: number;
  values: RecordValue[];
  formatted_values: string[];
  routing_policy: "SIMPLE";
  is_system: boolean;
  created_at: string;
  updated_at: string;
}

export interface RecordInput {
  name: string;
  type: RecordType;
  ttl: number;
  values: Partial<RecordValue>[];
}

export interface Page<T> {
  items: T[];
  total: number;
  page: number;
  page_size: number;
  total_pages: number;
}

export interface CurrentUser {
  username: string;
  account_id: string;
  session_expires_at: string;
}

export interface BulkDeleteResult {
  deleted: number[];
  failed: { id: number; message: string }[];
}

export interface ZoneImportIssue {
  line: number;
  message: string;
}

export interface ZoneImportResult {
  created: number;
  updated: number;
  skipped: ZoneImportIssue[];
  errors: ZoneImportIssue[];
}

export type SortOrder = "asc" | "desc";
