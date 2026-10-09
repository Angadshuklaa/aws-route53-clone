"use client";

import type { FlashbarProps } from "@cloudscape-design/components/flashbar";
import { createContext, useCallback, useContext, useMemo, useRef, useState, type ReactNode } from "react";

export interface NotificationInput {
  type: "success" | "error" | "info" | "warning";
  header?: ReactNode;
  content?: ReactNode;
}

interface NotificationsContextValue {
  items: FlashbarProps.MessageDefinition[];
  notify: (notification: NotificationInput) => void;
  clear: () => void;
}

const NotificationsContext = createContext<NotificationsContextValue | null>(null);

const AUTO_DISMISS_MS = 8000;

export function NotificationsProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<FlashbarProps.MessageDefinition[]>([]);
  const counter = useRef(0);

  const dismiss = useCallback((id: string) => setItems((current) => current.filter((item) => item.id !== id)), []);

  const notify = useCallback(
    ({ type, header, content }: NotificationInput) => {
      const id = `flash-${++counter.current}`;
      const item: FlashbarProps.MessageDefinition = {
        id,
        type,
        header,
        content,
        dismissible: true,
        dismissLabel: "Dismiss message",
        onDismiss: () => dismiss(id),
      };
      setItems((current) => [item, ...current].slice(0, 5));
      // Successes fade out; errors and warnings stay until dismissed.
      if (type === "success" || type === "info") window.setTimeout(() => dismiss(id), AUTO_DISMISS_MS);
    },
    [dismiss],
  );

  const clear = useCallback(() => setItems([]), []);
  const value = useMemo(() => ({ items, notify, clear }), [items, notify, clear]);

  return <NotificationsContext.Provider value={value}>{children}</NotificationsContext.Provider>;
}

export function useNotifications(): NotificationsContextValue {
  const context = useContext(NotificationsContext);
  if (!context) throw new Error("useNotifications must be used inside NotificationsProvider");
  return context;
}
