"use client";

import Alert from "@cloudscape-design/components/alert";
import Box from "@cloudscape-design/components/box";
import Button from "@cloudscape-design/components/button";
import FormField from "@cloudscape-design/components/form-field";
import Input from "@cloudscape-design/components/input";
import Modal from "@cloudscape-design/components/modal";
import SpaceBetween from "@cloudscape-design/components/space-between";
import { useState } from "react";

import { errorMessage } from "@/lib/api/client";
import { hostedZonesApi } from "@/lib/api/endpoints";
import { useNotifications } from "@/lib/notifications";
import type { HostedZone } from "@/lib/types";

const CONFIRMATION = "delete";

interface DeleteHostedZoneModalProps {
  zone: HostedZone;
  onDismiss: () => void;
  onDeleted: (zone: HostedZone) => void;
}

/** Confirms and deletes a hosted zone. Mount it only while it's open. */
export function DeleteHostedZoneModal({ zone, onDismiss, onDeleted }: DeleteHostedZoneModalProps) {
  const { notify } = useNotifications();
  const [confirmation, setConfirmation] = useState("");
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const userRecords = Math.max(0, zone.record_count - 2); // apex NS + SOA are always present
  const confirmed = confirmation.trim().toLowerCase() === CONFIRMATION;

  const confirm = async () => {
    if (!confirmed) return;
    setDeleting(true);
    setError(null);
    try {
      await hostedZonesApi.remove(zone.id);
      notify({ type: "success", content: `Hosted zone ${zone.name} was deleted.` });
      onDeleted(zone);
    } catch (err) {
      setError(errorMessage(err));
      setDeleting(false);
    }
  };

  return (
    <Modal
      visible
      onDismiss={() => !deleting && onDismiss()}
      header="Delete hosted zone?"
      footer={
        <Box float="right">
          <SpaceBetween direction="horizontal" size="xs">
            <Button variant="link" onClick={onDismiss} disabled={deleting}>
              Cancel
            </Button>
            <Button variant="primary" onClick={confirm} disabled={!confirmed} loading={deleting}>
              Delete
            </Button>
          </SpaceBetween>
        </Box>
      }
    >
      <SpaceBetween size="m">
        <Box variant="span">
          Permanently delete hosted zone <Box variant="strong">{zone.name}</Box> ({zone.id})? You can&apos;t undo this
          action.
        </Box>
        {userRecords > 0 && (
          <Alert type="warning" header={`This hosted zone contains ${userRecords} record${userRecords === 1 ? "" : "s"}`}>
            Deleting the hosted zone also deletes all of its records, in addition to the NS and SOA records that Route 53
            created.
          </Alert>
        )}
        {error && (
          <Alert type="error" header="The hosted zone couldn't be deleted">
            {error}
          </Alert>
        )}
        <form
          onSubmit={(event) => {
            event.preventDefault();
            void confirm();
          }}
        >
          <FormField
            label={
              <span>
                To confirm deletion, enter <i>{CONFIRMATION}</i> in the text input field.
              </span>
            }
          >
            <Input
              value={confirmation}
              onChange={({ detail }) => setConfirmation(detail.value)}
              placeholder={CONFIRMATION}
              ariaRequired
              autoFocus
            />
          </FormField>
        </form>
      </SpaceBetween>
    </Modal>
  );
}
