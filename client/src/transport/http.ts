import axios, { AxiosError, type AxiosRequestConfig, type InternalAxiosRequestConfig } from "axios";
import { authClient } from "../lib/firebase";
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

http.interceptors.response.use(undefined, async (error: AxiosError) => {
  const config = error.config as (InternalAxiosRequestConfig & { _retried?: boolean }) | undefined;
  // A token can expire between the request and the server checking it: refresh once and retry.
  if (error.response?.status === 401 && config && !config._retried && authClient.currentUser()) {
    config._retried = true;
    const token = await authClient.token(true);
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
          : "Can't reach TailorFlow right now. Try again shortly.",
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
