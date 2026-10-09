"use client";

import { useCallback, useEffect, useState } from "react";

import { errorMessage, isAbortError } from "@/lib/api/client";
import type { Page } from "@/lib/types";

interface PagedQueryOptions {
  onPageOverflow?: (lastPage: number) => void;
}

interface PagedQueryState<T> {
  load: unknown;
  reloadKey: number;
  data: Page<T> | null;
  error: string | null;
}

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
        // ignore
      }
    },
    [key],
  );
  return [value, update];
}
