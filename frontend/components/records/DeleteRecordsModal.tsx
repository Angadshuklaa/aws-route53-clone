"use client";

import Alert from "@cloudscape-design/components/alert";
import Box from "@cloudscape-design/components/box";
import Button from "@cloudscape-design/components/button";
import Modal from "@cloudscape-design/components/modal";
import SpaceBetween from "@cloudscape-design/components/space-between";
import { useState } from "react";

import { errorMessage } from "@/lib/api/client";
import { recordsApi } from "@/lib/api/endpoints";
import { useNotifications } from "@/lib/notifications";
import type { DnsRecord, HostedZone } from "@/lib/types";

const PREVIEW_LIMIT = 10;

interface DeleteRecordsModalProps {
  zone: HostedZone;
  records: DnsRecord[];
  onDismiss: () => void;
  onDeleted: (deletedIds: number[]) => void;
}

/** Confirms deletion of one or more records. Mount it only while it's open. */
export function DeleteRecordsModal({ zone, records, onDismiss, onDeleted }: DeleteRecordsModalProps) {
  const { notify } = useNotifications();
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const deletable = records.filter((record) => !record.is_system);
  const protectedRecords = records.filter((record) => record.is_system);
  const label = (record: DnsRecord) => `${record.name} (${record.type})`;
  const plural = deletable.length === 1 ? "record" : "records";

  const confirm = async () => {
    setDeleting(true);
    setError(null);
    try {
      if (deletable.length === 1) {
        await recordsApi.remove(zone.id, deletable[0].id);
        notify({ type: "success", content: `Record ${label(deletable[0])} was deleted.` });
        onDeleted([deletable[0].id]);
        return;
      }
      const result = await recordsApi.bulkRemove(
        zone.id,
        deletable.map((record) => record.id),
      );
      if (result.deleted.length > 0) {
        notify({ type: "success", content: `Deleted ${result.deleted.length} ${result.deleted.length === 1 ? "record" : "records"}.` });
      }
      if (result.failed.length > 0) {
        const names = new Map(deletable.map((record) => [record.id, label(record)]));
        notify({
          type: "error",
          header: `${result.failed.length} ${result.failed.length === 1 ? "record wasn't" : "records weren't"} deleted`,
          content: (
            <ul className="issue-list">
              {result.failed.map((failure) => (
                <li key={failure.id}>
                  {names.get(failure.id) ?? `Record ${failure.id}`}: {failure.message}
                </li>
              ))}
            </ul>
          ),
        });
      }
      onDeleted(result.deleted);
    } catch (err) {
      setError(errorMessage(err));
      setDeleting(false);
    }
  };

  return (
    <Modal
      visible
      onDismiss={() => !deleting && onDismiss()}
      header={deletable.length > 1 ? `Delete ${deletable.length} records?` : "Delete record?"}
      footer={
        <Box float="right">
          <SpaceBetween direction="horizontal" size="xs">
            <Button variant="link" onClick={onDismiss} disabled={deleting}>
              Cancel
            </Button>
            <Button variant="primary" onClick={confirm} loading={deleting} disabled={deletable.length === 0}>
              Delete
            </Button>
          </SpaceBetween>
        </Box>
      }
    >
      <SpaceBetween size="m">
        {deletable.length > 0 ? (
          <Box variant="span">
            Permanently delete the following {plural} from <Box variant="strong">{zone.name}</Box>? You can&apos;t undo
            this action.
          </Box>
        ) : (
          <Box variant="span">There are no records that can be deleted in your selection.</Box>
        )}
        {deletable.length > 0 && (
          <ul className="issue-list">
            {deletable.slice(0, PREVIEW_LIMIT).map((record) => (
              <li key={record.id}>{label(record)}</li>
            ))}
            {deletable.length > PREVIEW_LIMIT && <li>and {deletable.length - PREVIEW_LIMIT} more</li>}
          </ul>
        )}
        {protectedRecords.length > 0 && (
          <Alert type="info">
            The NS and SOA records at the zone apex are managed by Route 53 and can&apos;t be deleted.{" "}
            {deletable.length > 0 ? "They will be skipped." : ""}
          </Alert>
        )}
        {error && (
          <Alert type="error" header={`The ${plural} couldn't be deleted`}>
            {error}
          </Alert>
        )}
      </SpaceBetween>
    </Modal>
  );
}
