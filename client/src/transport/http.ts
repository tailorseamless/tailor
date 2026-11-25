import axios, { AxiosError, type AxiosRequestConfig, type InternalAxiosRequestConfig } from "axios";
import { authClient } from "../lib/firebase";
import { noteSessionEnded } from "../lib/sessionNotice";
import type { ApiResponse, Page, PaginationMeta, ValidationError } from "../types/api.types";

export const API_URL = (import.meta.env.VITE_API_URL as string | undefined) ?? "http://localhost:4000/api/v1";

/** Every failed call becomes one of these, so screens only handle one error shape. */
export class ApiError extends Error {
  constructor(
    message: string,
    public readonly statusCode: number,
    public readonly errors: ValidationError[] = [],
  ) {
    super(message);
    this.name = "ApiError";
  }

  /** The first error's details, e.g. `{ customerId }` on a duplicate-phone 409. */
  detail<T = Record<string, unknown>>(): T | null {
    return (this.errors[0] as T | undefined) ?? null;
  }
}

export const http = axios.create({ baseURL: API_URL, timeout: 30_000 });

http.interceptors.request.use(async (config: InternalAxiosRequestConfig) => {
  const token = await authClient.token();
  if (token) config.headers.set("Authorization", `Bearer ${token}`);
  return config;
});

/** What the API puts in `errors[0].message` when a sign-in is older than a session may be. */
const SESSION_EXPIRED = "session_expired";

/** Whether this failed call says the sign-in has run out (the server's session limit), as opposed to a bad token. */
export const isSessionEnded = (err: unknown): boolean =>
  err instanceof ApiError && err.statusCode === 401 && err.errors[0]?.message === SESSION_EXPIRED;

http.interceptors.response.use(undefined, async (error: AxiosError) => {
  const config = error.config as (InternalAxiosRequestConfig & { _retried?: boolean }) | undefined;
  const body = error.response?.data as { errors?: { message?: string }[] } | undefined;
  if (error.response?.status === 401 && body?.errors?.[0]?.message === SESSION_EXPIRED) {
    // A fresh token would not help: only signing in again does. Signing out sends them to the sign-in page.
    noteSessionEnded();
    await authClient.signOut().catch(() => undefined);
    throw error;
  }
  // The token was too old (the API's ACCESS_TOKEN_LIFETIME) or ran out in flight: get a new one straight away and send
  // the request again, once. The person stays signed in and never sees it. A request fired together with this one may
  // already have fetched the new token, so use the current one if it differs before asking for another.
  // The API says the email isn't confirmed, but the person has confirmed it since this token was issued: its claim is
  // stale. The token is the API's only source for that, so a fresh one is the fix. Once only: if it still says no, it's true.
  const staleVerification = error.response?.status === 403 && body?.errors?.[0]?.message === "not_verified";
  if ((error.response?.status === 401 || staleVerification) && config && !config._retried && authClient.currentUser()) {
    config._retried = true;
    const sent = String(config.headers.get("Authorization") ?? "").replace(/^Bearer /, "");
    let token = await authClient.token();
    if (!token || token === sent) token = await authClient.token(true);
    if (token) config.headers.set("Authorization", `Bearer ${token}`);
    return http.request(config);
  }
  throw error;
});

async function toApiError(err: unknown): Promise<ApiError> {
  if (err instanceof ApiError) return err;
  if (axios.isAxiosError(err)) {
    if (!err.response) {
      const offline = typeof navigator !== "undefined" && !navigator.onLine;
      return new ApiError(
        offline
          ? "You're offline. Check your connection and try again."
          : "Can't reach Tailor Seamless right now. Try again shortly.",
        0,
      );
    }
    let body = err.response.data as Partial<ApiResponse<unknown>> | Blob | undefined;
    if (body instanceof Blob) {
      try {
        body = JSON.parse(await body.text()) as Partial<ApiResponse<unknown>>;
      } catch {
        body = undefined;
      }
    }
    const status = err.response.status;
    const message =
      (body as Partial<ApiResponse<unknown>> | undefined)?.message ??
      (status === 429 ? "Too many requests. Wait a moment and try again." : "Something went wrong. Please try again.");
    return new ApiError(message, status, (body as Partial<ApiResponse<unknown>> | undefined)?.errors ?? []);
  }
  return new ApiError(err instanceof Error ? err.message : "Something went wrong.", 0);
}

/** Runs a call and returns the envelope's `data`. */
export async function wrapCall<T>(call: () => Promise<{ data: ApiResponse<T> }>): Promise<T> {
  try {
    const res = await call();
    return res.data.data as T;
  } catch (err) {
    throw await toApiError(err);
  }
}

/** Runs a list call and keeps the pagination meta. */
export async function wrapPage<T>(call: () => Promise<{ data: ApiResponse<T[]> }>): Promise<Page<T>> {
  try {
    const res = await call();
    return { data: res.data.data ?? [], meta: (res.data.meta as PaginationMeta | undefined) ?? null };
  } catch (err) {
    throw await toApiError(err);
  }
}

/** Runs a call and returns the whole envelope, for the rare response with extra top-level fields. */
export async function wrapEnvelope<T>(call: () => Promise<{ data: T }>): Promise<T> {
  try {
    return (await call()).data;
  } catch (err) {
    throw await toApiError(err);
  }
}

/** Sends files as multipart form data under one field name. */
export async function wrapUpload<T>(url: string, field: string, files: File[]): Promise<T> {
  const form = new FormData();
  for (const file of files) form.append(field, file);
  return wrapCall<T>(() => http.post(url, form, { timeout: 120_000 }));
}

/** Fetches a file (PDF, spreadsheet) with the user's token and returns it with the server's file name. */
export async function downloadFile(
  url: string,
  fallbackName: string,
  config: AxiosRequestConfig = {},
): Promise<{ blob: Blob; filename: string }> {
  try {
    const res = await http.get<Blob>(url, { ...config, responseType: "blob" });
    const disposition = String(res.headers["content-disposition"] ?? "");
    const match = /filename\*?=(?:UTF-8'')?"?([^";]+)"?/i.exec(disposition);
    return { blob: res.data, filename: match ? decodeURIComponent(match[1]) : fallbackName };
  } catch (err) {
    throw await toApiError(err);
  }
}

/** A fresh key for POSTs the server de-duplicates (orders, payments). Reuse it when retrying the same submit. */
export function newIdempotencyKey(): string {
  return crypto.randomUUID();
}

/** Drops empty values so they don't become `?search=` on the URL. */
export function cleanParams<T extends object>(params: T | undefined): Record<string, string | number | boolean> {
  const out: Record<string, string | number | boolean> = {};
  if (!params) return out;
  for (const [key, value] of Object.entries(params)) {
    if (value === undefined || value === null || value === "") continue;
    out[key] = value as string | number | boolean;
  }
  return out;
}
