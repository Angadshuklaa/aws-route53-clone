"use client";

import Alert from "@cloudscape-design/components/alert";
import Box from "@cloudscape-design/components/box";
import Button from "@cloudscape-design/components/button";
import Modal from "@cloudscape-design/components/modal";

import { usePreferences } from "@/lib/preferences";

/** CloudShell isn't part of this clone; the header and footer buttons explain that. */
export function CloudShellModal() {
  const { cloudShellVisible, setCloudShellVisible } = usePreferences();
  if (!cloudShellVisible) return null;
  return (
    <Modal
      visible
      onDismiss={() => setCloudShellVisible(false)}
      header="CloudShell"
      footer={
        <Box float="right">
          <Button variant="primary" onClick={() => setCloudShellVisible(false)}>
            Close
          </Button>
        </Box>
      }
    >
      <Alert type="info" header="Coming soon">
        CloudShell, a browser-based terminal, isn&apos;t available in this Route 53 clone. You can manage hosted zones and
        records from the console, or call the REST API documented at /api/docs.
      </Alert>
    </Modal>
  );
}
