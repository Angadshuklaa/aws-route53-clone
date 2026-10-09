/**
 * Thin fetch wrapper for the FastAPI backend.
 *
 * Requests go to `${NEXT_PUBLIC_API_BASE_URL}/api/...` when that variable is
 * set, otherwise to the same origin where Next.js proxies `/api/*` to the
 * backend (see next.config.ts). Cookies are always sent.
 */

const API_BASE_URL = (process.env.NEXT_PUBLIC_API_BASE_URL ?? "").replace(/\/+$/, "");

export interface FieldError {
  field: string;
  message: string;
}

export class ApiError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
    readonly details: FieldError[] = [],
  ) {
    super(message);
    this.name = "ApiError";
  }

  /** Field-level errors keyed by field path, e.g. `values[0].priority`. */
  fieldErrors(): Record<string, string> {
    return Object.fromEntries(this.details.map((detail) => [detail.field, detail.message]));
  }
}

type QueryValue = string | number | boolean | null | undefined | (string | number)[];

interface RequestOptions {
  method?: "GET" | "POST" | "PUT" | "DELETE";
  query?: Record<string, QueryValue>;
  body?: unknown;
  signal?: AbortSignal;
}

let unauthorizedHandler: (() => void) | null = null;

/** Called when an authenticated request comes back 401 (e.g. the session expired). */
export function setUnauthorizedHandler(handler: (() => void) | null): void {
  unauthorizedHandler = handler;
}

function buildUrl(path: string, query?: Record<string, QueryValue>): string {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(query ?? {})) {
    if (value === undefined || value === null || value === "") continue;
    if (Array.isArray(value)) value.forEach((item) => params.append(key, String(item)));
    else params.append(key, String(value));
  }
  const queryString = params.toString();
  return `${API_BASE_URL}${path}${queryString ? `?${queryString}` : ""}`;
}

async function send(path: string, options: RequestOptions): Promise<Response> {
  const { method = "GET", query, body, signal } = options;
  let response: Response;
  try {
    response = await fetch(buildUrl(path, query), {
      method,
      credentials: "include",
      cache: "no-store",
      headers: body === undefined ? undefined : { "Content-Type": "application/json" },
      body: body === undefined ? undefined : JSON.stringify(body),
      signal,
    });
  } catch (error) {
    if (error instanceof DOMException && error.name === "AbortError") throw error;
    throw new ApiError(0, "NETWORK_ERROR", "We couldn't reach the Route 53 service. Check your connection and try again.");
  }

  if (!response.ok) {
    const payload = await response.json().catch(() => null);
    const error = payload?.error;
    const apiError = new ApiError(
      response.status,
      error?.code ?? "HTTP_ERROR",
      error?.message ?? `The request failed with status ${response.status}.`,
      Array.isArray(error?.details) ? error.details : [],
    );
    if (response.status === 401 && apiError.code === "UNAUTHORIZED") unauthorizedHandler?.();
    throw apiError;
  }
  return response;
}

export async function apiRequest<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const response = await send(path, options);
  if (response.status === 204) return undefined as T;
  return (await response.json()) as T;
}

export async function apiDownload(path: string, query?: Record<string, QueryValue>): Promise<void> {
  const response = await send(path, { query });
  const disposition = response.headers.get("Content-Disposition") ?? "";
  const filename = /filename="([^"]+)"/.exec(disposition)?.[1] ?? "download";
  const url = URL.createObjectURL(await response.blob());
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}

export function isAbortError(error: unknown): boolean {
  return error instanceof DOMException && error.name === "AbortError";
}

export function errorMessage(error: unknown): string {
  if (error instanceof ApiError) return error.message;
  return "An unexpected error occurred. Please try again.";
}
