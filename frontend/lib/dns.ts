import type { CreatableRecordType, RecordType, RecordValue } from "@/lib/types";

export type ValueField = "value" | "priority" | "weight" | "port" | "flags" | "tag";

export interface FieldSpec {
  key: ValueField;
  label: string;
  placeholder: string;
  numeric?: { min: number; max: number };
  options?: string[];
}

export interface RecordTypeSpec {
  description: string;
  fields: FieldSpec[];
  valueHelp: string;
  maxValues: number;
}

export const CREATABLE_RECORD_TYPES: CreatableRecordType[] = ["A", "AAAA", "CAA", "CNAME", "MX", "NS", "PTR", "SRV", "TXT"];
export const ALL_RECORD_TYPES: RecordType[] = [...CREATABLE_RECORD_TYPES, "SOA"];
export const CAA_TAGS = ["issue", "issuewild", "issuemail", "iodef"];

const U16 = { min: 0, max: 65535 };

export const RECORD_TYPES: Record<RecordType, RecordTypeSpec> = {
  A: {
    description: "Routes traffic to an IPv4 address",
    fields: [{ key: "value", label: "IPv4 address", placeholder: "192.0.2.235" }],
    valueHelp: "Enter one IPv4 address per value.",
    maxValues: 100,
  },
  AAAA: {
    description: "Routes traffic to an IPv6 address",
    fields: [{ key: "value", label: "IPv6 address", placeholder: "2001:db8:85a3::8a2e:370:7334" }],
    valueHelp: "Enter one IPv6 address per value.",
    maxValues: 100,
  },
  CAA: {
    description: "Restricts which certificate authorities can issue certificates for the domain",
    fields: [
      { key: "flags", label: "Flags", placeholder: "0", numeric: { min: 0, max: 255 } },
      { key: "tag", label: "Tag", placeholder: "issue", options: CAA_TAGS },
      { key: "value", label: "Value", placeholder: "amazon.com" },
    ],
    valueHelp: "For example: 0 issue \"amazon.com\". Use iodef with a mailto: or https:// URL for reports.",
    maxValues: 100,
  },
  CNAME: {
    description: "Routes traffic to another domain name",
    fields: [{ key: "value", label: "Domain name", placeholder: "www.example.com" }],
    valueHelp: "A CNAME record has exactly one value and can't be created at the zone apex.",
    maxValues: 1,
  },
  MX: {
    description: "Specifies mail servers",
    fields: [
      { key: "priority", label: "Priority", placeholder: "10", numeric: U16 },
      { key: "value", label: "Mail server", placeholder: "mail.example.com" },
    ],
    valueHelp: "Lower priority values are preferred.",
    maxValues: 100,
  },
  NS: {
    description: "Identifies the name servers for a hosted zone or subdomain",
    fields: [{ key: "value", label: "Name server", placeholder: "ns-1.example.net" }],
    valueHelp: "Enter one name server per value.",
    maxValues: 100,
  },
  PTR: {
    description: "Maps an IP address to a domain name",
    fields: [{ key: "value", label: "Domain name", placeholder: "hostname.example.com" }],
    valueHelp: "Used for reverse DNS lookups.",
    maxValues: 100,
  },
  SRV: {
    description: "Application-specific values that identify servers",
    fields: [
      { key: "priority", label: "Priority", placeholder: "10", numeric: U16 },
      { key: "weight", label: "Weight", placeholder: "5", numeric: U16 },
      { key: "port", label: "Port", placeholder: "5060", numeric: U16 },
      { key: "value", label: "Target", placeholder: "sip.example.com" },
    ],
    valueHelp: "Record names usually look like _service._protocol, for example _sip._tcp.",
    maxValues: 100,
  },
  TXT: {
    description: "Verifies email senders and stores application-specific text",
    fields: [{ key: "value", label: "Text", placeholder: "v=spf1 include:_spf.example.com ~all" }],
    valueHelp: "Enter the text without surrounding quotation marks. Each value is stored as a separate string.",
    maxValues: 100,
  },
  SOA: {
    description: "Start of authority information for the hosted zone",
    fields: [{ key: "value", label: "SOA value", placeholder: "ns-1.awsdns-01.com. hostmaster.example.com. 1 7200 900 1209600 86400" }],
    valueHelp: "Primary name server, admin email, serial, refresh, retry, expire and minimum TTL.",
    maxValues: 1,
  },
};

export type ValueRow = Record<ValueField, string>;

export const emptyRow = (type: RecordType): ValueRow => ({
  value: "",
  priority: "",
  weight: "",
  port: "",
  flags: type === "CAA" ? "0" : "",
  tag: type === "CAA" ? "issue" : "",
});

export const rowFromValue = (value: RecordValue): ValueRow => ({
  value: value.value,
  priority: value.priority?.toString() ?? "",
  weight: value.weight?.toString() ?? "",
  port: value.port?.toString() ?? "",
  flags: value.flags?.toString() ?? "",
  tag: value.tag ?? "",
});

export function rowToPayload(type: RecordType, row: ValueRow): Partial<RecordValue> {
  const payload: Partial<RecordValue> = { value: type === "TXT" ? row.value : row.value.trim() };
  for (const field of RECORD_TYPES[type].fields) {
    if (field.numeric) payload[field.key as "priority"] = row[field.key].trim() === "" ? null : Number(row[field.key]);
    else if (field.key === "tag") payload.tag = row.tag;
  }
  return payload;
}

const ZONE_LABEL = /^[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?$/;
const HOST_LABEL = /^[a-z0-9_]([a-z0-9_-]{0,61}[a-z0-9_])?$/;
const IPV4 = /^(25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)(\.(25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)){3}$/;
const PRINTABLE_ASCII = /^[\x20-\x7e]*$/;

const stripDot = (value: string) => value.trim().toLowerCase().replace(/\.$/, "");

export function validateZoneName(input: string): string | null {
  const name = stripDot(input);
  if (!name) return "Enter a domain name.";
  if (name.length > 253) return "The domain name must be 253 characters or fewer.";
  const labels = name.split(".");
  if (labels.some((label) => !label)) return "The domain name can't contain empty labels (two dots in a row).";
  const bad = labels.find((label) => label.length > 63 || !ZONE_LABEL.test(label));
  if (bad !== undefined) {
    return `"${bad}" isn't a valid label. Use letters, numbers and hyphens, and don't start or end a label with a hyphen.`;
  }
  if (labels.length < 2) return "Enter a fully qualified domain name, such as example.com.";
  if (/^\d+$/.test(labels[labels.length - 1])) return "The top-level domain can't be numeric.";
  return null;
}

export function validateHostname(input: string): string | null {
  const host = stripDot(input);
  if (!host) return "Enter a domain name.";
  if (host.length > 253) return "The domain name must be 253 characters or fewer.";
  const labels = host.split(".");
  if (labels.some((label) => !label)) return "The domain name can't contain empty labels.";
  const bad = labels.find((label) => label.length > 63 || !HOST_LABEL.test(label));
  if (bad !== undefined) return `"${bad}" isn't a valid label.`;
  if (labels.every((label) => /^\d+$/.test(label))) return "Enter a domain name, not an IP address.";
  return null;
}

export function validateRecordPrefix(prefix: string, zoneName: string): string | null {
  const value = prefix.trim().toLowerCase().replace(/\.$/, "");
  if (!value) return null; // blank = zone apex
  const full = `${value}.${zoneName}`;
  if (full.length > 253) return "The record name must be 253 characters or fewer.";
  const labels = value.split(".");
  for (const [index, label] of labels.entries()) {
    if (label === "*" && index === 0) continue;
    if (label === "*") return "A wildcard (*) is allowed only as the leftmost label.";
    if (!label) return "The record name can't contain empty labels (two dots in a row).";
    if (label.length > 63 || !HOST_LABEL.test(label)) {
      return `"${label}" isn't a valid label. Use letters, numbers, hyphens and underscores.`;
    }
  }
  return null;
}

function isIPv6(value: string): boolean {
  if (!value.includes(":") || /[^0-9a-fA-F:.]/.test(value)) return false;
  try {
    new URL(`http://[${value}]/`);
    return true;
  } catch {
    return false;
  }
}

function validateNumber(raw: string, label: string, min: number, max: number): string | null {
  if (raw.trim() === "") return `Enter a ${label.toLowerCase()}.`;
  if (!/^\d+$/.test(raw.trim()) || Number(raw) < min || Number(raw) > max) {
    return `${label} must be a whole number between ${min} and ${max}.`;
  }
  return null;
}

export type RowErrors = Partial<Record<ValueField, string>>;

export function validateRows(type: RecordType, rows: ValueRow[]): { rows: RowErrors[]; form: string | null } {
  const spec = RECORD_TYPES[type];
  const rowErrors: RowErrors[] = rows.map((row) => {
    const errors: RowErrors = {};
    for (const field of spec.fields) {
      if (!field.numeric) continue;
      const error = validateNumber(row[field.key], field.label, field.numeric.min, field.numeric.max);
      if (error) errors[field.key] = error;
    }
    const value = type === "TXT" ? row.value : row.value.trim();
    let valueError: string | null = null;
    switch (type) {
      case "A":
        valueError = IPV4.test(value) ? null : "Enter a valid IPv4 address, such as 192.0.2.44.";
        break;
      case "AAAA":
        valueError = isIPv6(value) ? null : "Enter a valid IPv6 address, such as 2001:db8::1.";
        break;
      case "CNAME":
      case "NS":
      case "PTR":
      case "MX":
        valueError = validateHostname(value);
        break;
      case "SRV":
        valueError = value === "." ? null : validateHostname(value);
        break;
      case "TXT":
        if (!value) valueError = "Enter a text value.";
        else if (value.length > 4000) valueError = "A TXT value can have up to 4000 characters.";
        else if (!PRINTABLE_ASCII.test(value)) valueError = "Use printable ASCII characters only (no line breaks).";
        break;
      case "CAA":
        if (!CAA_TAGS.includes(row.tag)) errors.tag = "Choose a tag.";
        if (!value) valueError = "Enter a value, such as amazon.com.";
        else if (!PRINTABLE_ASCII.test(value)) valueError = "Use printable ASCII characters only.";
        else if (row.tag === "iodef" && !/^(mailto:|https?:\/\/)/.test(value)) {
          valueError = "An iodef value must be a mailto:, http:// or https:// URL.";
        }
        break;
      case "SOA":
        valueError = value.split(/\s+/).length === 7 ? null : "An SOA value has 7 space-separated fields.";
        break;
    }
    if (valueError) errors.value = valueError;
    return errors;
  });

  const seen = new Set<string>();
  rows.forEach((row, index) => {
    const key = JSON.stringify(rowToPayload(type, row));
    if (seen.has(key) && !rowErrors[index].value) rowErrors[index].value = "Duplicate value. Each value must be unique.";
    seen.add(key);
  });

  let form: string | null = null;
  if (rows.length === 0) form = "Enter at least one value.";
  else if (rows.length > spec.maxValues) form = `A ${type} record can have at most ${spec.maxValues} value(s).`;
  return { rows: rowErrors, form };
}

export function validateTtl(raw: string): string | null {
  return validateNumber(raw, "TTL", 0, 2147483647);
}

export function recordPrefix(recordName: string, zoneName: string): string {
  return recordName === zoneName ? "" : recordName.slice(0, -(zoneName.length + 1));
}

export function fullRecordName(prefix: string, zoneName: string): string {
  const value = prefix.trim().toLowerCase().replace(/\.$/, "");
  return value ? `${value}.${zoneName}` : zoneName;
}
