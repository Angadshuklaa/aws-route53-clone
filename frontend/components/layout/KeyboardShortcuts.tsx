"use client";

import Box from "@cloudscape-design/components/box";
import Button from "@cloudscape-design/components/button";
import Modal from "@cloudscape-design/components/modal";
import Table from "@cloudscape-design/components/table";
import { useRouter } from "next/navigation";

import { ROUTES } from "@/lib/routes";
import { SHORTCUTS, useHotkeys } from "@/lib/hotkeys";
import { usePreferences } from "@/lib/preferences";

export function KeyboardShortcuts() {
  const router = useRouter();
  const { shortcutsVisible, setShortcutsVisible } = usePreferences();

  useHotkeys({
    "?": () => setShortcutsVisible(true),
    "g h": () => router.push(ROUTES.hostedZones),
  });

  if (!shortcutsVisible) return null;
  return (
    <Modal
      visible
      onDismiss={() => setShortcutsVisible(false)}
      header="Keyboard shortcuts"
      footer={
        <Box float="right">
          <Button variant="primary" onClick={() => setShortcutsVisible(false)}>
            Close
          </Button>
        </Box>
      }
    >
      <Table
        variant="embedded"
        items={SHORTCUTS}
        columnDefinitions={[
          { id: "keys", header: "Shortcut", cell: (item) => <Box variant="code">{item.keys}</Box> },
          { id: "description", header: "Action", cell: (item) => item.description },
        ]}
      />
      <Box variant="small" color="text-body-secondary" padding={{ top: "s" }}>
        Shortcuts are ignored while you type in a field or a dialog is open.
      </Box>
    </Modal>
  );
}
