"use client";

import { useEffect, useRef } from "react";

export const SHORTCUTS: { keys: string; description: string }[] = [
  { keys: "/", description: "Focus the filter on the current table" },
  { keys: "c", description: "Create a hosted zone or record" },
  { keys: "r", description: "Refresh the current table" },
  { keys: "g then h", description: "Go to Hosted zones" },
  { keys: "?", description: "Show keyboard shortcuts" },
];

function isTypingTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  return target.isContentEditable || ["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName);
}

function modalIsOpen(): boolean {
  return document.querySelector('[role="dialog"][aria-modal="true"]') !== null;
}

/**
 * Registers single-key shortcuts. They are ignored while the user types in a
 * form field, holds a modifier key, or has a modal open.
 */
export function useHotkeys(bindings: Record<string, () => void>, enabled = true): void {
  const bindingsRef = useRef(bindings);
  useEffect(() => {
    bindingsRef.current = bindings;
  });

  useEffect(() => {
    if (!enabled) return;
    let pendingPrefix: string | null = null;
    let prefixTimer: number | undefined;

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.defaultPrevented || event.metaKey || event.ctrlKey || event.altKey) return;
      if (isTypingTarget(event.target) || modalIsOpen()) return;

      const key = pendingPrefix ? `${pendingPrefix} ${event.key}` : event.key;
      pendingPrefix = null;
      window.clearTimeout(prefixTimer);

      const handler = bindingsRef.current[key];
      if (handler) {
        event.preventDefault();
        handler();
        return;
      }
      if (Object.keys(bindingsRef.current).some((binding) => binding.startsWith(`${event.key} `))) {
        pendingPrefix = event.key;
        prefixTimer = window.setTimeout(() => (pendingPrefix = null), 1000);
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      window.clearTimeout(prefixTimer);
    };
  }, [enabled]);
}
