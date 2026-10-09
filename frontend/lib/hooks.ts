"use client";

import { useCallback, useEffect, useState } from "react";

import { errorMessage, isAbortError } from "@/lib/api/client";
import type { Page } from "@/lib/types";

export function useDebouncedValue<T>(value: T, delayMs = 300): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const timer = window.setTimeout(() => setDebounced(value), delayMs);
    return () => window.clearTimeout(timer);
  }, [value, delayMs]);
  return debounced;
}

interface PagedQueryOptions {
  /** Called when the requested page is past the end (e.g. after deletions or a narrower filter). */
  onPageOverflow?: (lastPage: number) => void;
}

interface PagedQueryState<T> {
  load: unknown;
  reloadKey: number;
  data: Page<T> | null;
  error: string | null;
}

/**
 * Runs `load` whenever it changes (memoize it with the query parameters) and
 * cancels stale requests. The previous page stays available while loading.
 */
export function usePagedQuery<T>(load: (signal: AbortSignal) => Promise<Page<T>>, options: PagedQueryOptions = {}) {
  const { onPageOverflow } = options;
  const [reloadKey, setReloadKey] = useState(0);
  const [state, setState] = useState<PagedQueryState<T>>({ load: null, reloadKey: -1, data: null, error: null });

  useEffect(() => {
    const controller = new AbortController();
    load(controller.signal).then(
      (data) => {
        if (data.items.length === 0 && data.total > 0 && data.page > data.total_pages && onPageOverflow) {
          onPageOverflow(data.total_pages);
          return;
        }
        setState({ load, reloadKey, data, error: null });
      },
      (error: unknown) => {
        if (isAbortError(error)) return;
        setState((previous) => ({ load, reloadKey, data: previous.data, error: errorMessage(error) }));
      },
    );
    return () => controller.abort();
  }, [load, reloadKey, onPageOverflow]);

  const reload = useCallback(() => setReloadKey((key) => key + 1), []);
  const loading = state.load !== load || state.reloadKey !== reloadKey;
  return { data: state.data, error: loading ? null : state.error, loading, reload };
}

/** Table preferences remembered per browser. Falls back to defaults if storage is unavailable. */
export function useStoredState<T>(key: string, defaults: T): [T, (value: T) => void] {
  const [value, setValue] = useState<T>(() => {
    try {
      const raw = window.localStorage.getItem(key);
      return raw ? { ...defaults, ...JSON.parse(raw) } : defaults;
    } catch {
      return defaults;
    }
  });
  const update = useCallback(
    (next: T) => {
      setValue(next);
      try {
        window.localStorage.setItem(key, JSON.stringify(next));
      } catch {
        // Not persisted; the preference still applies for this session.
      }
    },
    [key],
  );
  return [value, update];
}
