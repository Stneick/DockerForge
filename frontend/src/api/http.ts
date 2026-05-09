// Thin fetch wrapper for the DockerForge API.
//
// Auth is cookie-based (httponly access_token + refresh_token set by the
// backend), so every request sends credentials and we never touch tokens in JS.
// On a 401 we transparently attempt a single /auth/refresh and replay the
// request once; if that fails we surface an ApiError the app can route to login.

export const API_BASE = "/api/v1";

export interface ApiErrorDetail {
  field?: string;
  message: string;
}

export class ApiError extends Error {
  status: number;
  code?: string;
  details?: ApiErrorDetail[];
  constructor(
    status: number,
    message: string,
    code?: string,
    details?: ApiErrorDetail[],
  ) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

/** Listeners notified when the session is irrecoverably unauthenticated. */
type UnauthorizedHandler = () => void;
let onUnauthorized: UnauthorizedHandler | null = null;
export function setUnauthorizedHandler(handler: UnauthorizedHandler | null) {
  onUnauthorized = handler;
}

/** Listener for Docker daemon health, inferred from 503s vs successful calls. */
type HealthHandler = (ok: boolean) => void;
let onHealth: HealthHandler | null = null;
export function setHealthHandler(handler: HealthHandler | null) {
  onHealth = handler;
}

interface RequestOptions extends Omit<RequestInit, "body"> {
  body?: unknown;
  /** Skip the automatic refresh-on-401 retry (used by auth calls themselves). */
  skipRefresh?: boolean;
  /** Override JSON serialization (e.g. FormData uploads). */
  rawBody?: BodyInit;
  query?: Record<string, string | number | boolean | undefined | null>;
}

function buildUrl(path: string, query?: RequestOptions["query"]): string {
  const url = `${API_BASE}${path}`;
  if (!query) return url;
  const params = new URLSearchParams();
  for (const [k, v] of Object.entries(query)) {
    if (v !== undefined && v !== null) params.set(k, String(v));
  }
  const qs = params.toString();
  return qs ? `${url}?${qs}` : url;
}

async function parseError(res: Response): Promise<ApiError> {
  let code: string | undefined;
  let message = res.statusText || "Request failed";
  let details: ApiErrorDetail[] | undefined;
  try {
    const data = await res.json();
    // Backend shapes: {error, message, details?} OR FastAPI {detail}
    if (typeof data?.message === "string") message = data.message;
    else if (typeof data?.detail === "string") message = data.detail;
    else if (Array.isArray(data?.detail)) {
      // FastAPI validation errors
      details = data.detail.map(
        (d: { loc?: (string | number)[]; msg: string }) => ({
          field: Array.isArray(d.loc) ? String(d.loc[d.loc.length - 1]) : undefined,
          message: d.msg,
        }),
      );
      message = details?.[0]?.message ?? message;
    }
    if (typeof data?.error === "string") code = data.error;
    if (Array.isArray(data?.details)) details = data.details;
  } catch {
    /* non-JSON error body */
  }
  return new ApiError(res.status, message, code, details);
}

let refreshInFlight: Promise<boolean> | null = null;

async function tryRefresh(): Promise<boolean> {
  // Coalesce concurrent refreshes into one network call.
  if (!refreshInFlight) {
    refreshInFlight = fetch(`${API_BASE}/auth/refresh`, {
      method: "POST",
      credentials: "include",
    })
      .then((r) => r.ok)
      .catch(() => false)
      .finally(() => {
        refreshInFlight = null;
      });
  }
  return refreshInFlight;
}

async function doFetch(path: string, opts: RequestOptions): Promise<Response> {
  const { body, rawBody, query, headers, skipRefresh: _s, ...rest } = opts;
  const init: RequestInit = {
    ...rest,
    credentials: "include",
    headers: {
      Accept: "application/json",
      ...(rawBody ? {} : body !== undefined ? { "Content-Type": "application/json" } : {}),
      ...headers,
    },
  };
  if (rawBody !== undefined) init.body = rawBody;
  else if (body !== undefined) init.body = JSON.stringify(body);
  return fetch(buildUrl(path, query), init);
}

export async function request<T>(path: string, opts: RequestOptions = {}): Promise<T> {
  let res = await doFetch(path, opts);

  if (res.status === 401 && !opts.skipRefresh) {
    const refreshed = await tryRefresh();
    if (refreshed) {
      res = await doFetch(path, opts);
    } else {
      onUnauthorized?.();
      throw await parseError(res);
    }
  }

  if (!res.ok) {
    if (res.status === 401) onUnauthorized?.();
    if (res.status === 503) onHealth?.(false);
    throw await parseError(res);
  }

  onHealth?.(true);

  if (res.status === 204) return undefined as T;
  const ct = res.headers.get("content-type") ?? "";
  if (ct.includes("application/json")) return (await res.json()) as T;
  return (await res.text()) as unknown as T;
}

export const api = {
  get: <T>(path: string, opts?: RequestOptions) =>
    request<T>(path, { ...opts, method: "GET" }),
  post: <T>(path: string, body?: unknown, opts?: RequestOptions) =>
    request<T>(path, { ...opts, method: "POST", body }),
  patch: <T>(path: string, body?: unknown, opts?: RequestOptions) =>
    request<T>(path, { ...opts, method: "PATCH", body }),
  put: <T>(path: string, body?: unknown, opts?: RequestOptions) =>
    request<T>(path, { ...opts, method: "PUT", body }),
  del: <T>(path: string, opts?: RequestOptions) =>
    request<T>(path, { ...opts, method: "DELETE" }),
};
