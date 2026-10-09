"use client";

import Button from "@cloudscape-design/components/button";
import CopyToClipboard from "@cloudscape-design/components/copy-to-clipboard";
import KeyValuePairs from "@cloudscape-design/components/key-value-pairs";
import SpaceBetween from "@cloudscape-design/components/space-between";
import SplitPanel from "@cloudscape-design/components/split-panel";

import { formatDateTime } from "@/lib/format";
import type { DnsRecord } from "@/lib/types";

interface RecordDetailsPanelProps {
  record: DnsRecord;
  onEdit: () => void;
  onDelete: () => void;
}

export function RecordDetailsPanel({ record, onEdit, onDelete }: RecordDetailsPanelProps) {
  return (
    <SplitPanel
      header="Record details"
      headerActions={
        <SpaceBetween direction="horizontal" size="xs">
          <Button onClick={onEdit}>Edit record</Button>
          <Button onClick={onDelete} disabled={record.is_system}>
            Delete record
          </Button>
        </SpaceBetween>
      }
      closeBehavior="hide"
    >
      <KeyValuePairs
        columns={1}
        items={[
          {
            label: "Record name",
            value: (
              <CopyToClipboard
                variant="inline"
                textToCopy={record.name}
                copyButtonAriaLabel="Copy record name"
                copySuccessText="Record name copied"
                copyErrorText="Record name failed to copy"
              />
            ),
          },
          { label: "Record type", value: record.type },
          {
            label: "Value",
            value: (
              <ul className="value-lines">
                {record.formatted_values.map((value, index) => (
                  <li key={index}>{value}</li>
                ))}
              </ul>
            ),
          },
          { label: "Alias", value: "No" },
          { label: "TTL (seconds)", value: record.ttl },
          { label: "Routing policy", value: "Simple" },
          { label: "Record ID", value: record.id },
          { label: "Created", value: formatDateTime(record.created_at) },
          { label: "Last updated", value: formatDateTime(record.updated_at) },
        ]}
      />
    </SplitPanel>
  );
}
