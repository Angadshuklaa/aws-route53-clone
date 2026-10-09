"use client";

import Box from "@cloudscape-design/components/box";
import Button from "@cloudscape-design/components/button";
import SpaceBetween from "@cloudscape-design/components/space-between";
import StatusIndicator from "@cloudscape-design/components/status-indicator";
import type { ReactNode } from "react";

export function TableEmptyState({ title, subtitle, action }: { title: string; subtitle: string; action?: ReactNode }) {
  return (
    <Box textAlign="center" color="inherit" padding={{ vertical: "s" }}>
      <SpaceBetween size="xxs">
        <Box variant="strong" color="inherit">
          {title}
        </Box>
        <Box variant="p" color="inherit" padding={{ bottom: "s" }}>
          {subtitle}
        </Box>
      </SpaceBetween>
      {action}
    </Box>
  );
}

export function TableNoMatchState({ onClearFilter }: { onClearFilter: () => void }) {
  return (
    <TableEmptyState
      title="No matches"
      subtitle="We can't find a match. Try a different search or clear the filters."
      action={<Button onClick={onClearFilter}>Clear filters</Button>}
    />
  );
}

export function TableErrorState({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <Box textAlign="center" padding={{ vertical: "s" }}>
      <SpaceBetween size="s" alignItems="center">
        <StatusIndicator type="error">{message}</StatusIndicator>
        <Button onClick={onRetry}>Retry</Button>
      </SpaceBetween>
    </Box>
  );
}
