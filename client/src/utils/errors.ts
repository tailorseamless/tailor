import { ApiError } from "../transport/http";
import type { ValidationError } from "../types/api.types";

/** A sentence a person can read, from anything thrown. */
export function errorMessage(err: unknown): string {
  if (err instanceof ApiError) return err.message;
  if (err instanceof Error && err.message) return err.message;
  return "Something went wrong. Please try again.";
}

export function fieldErrors(err: unknown): ValidationError[] {
  return err instanceof ApiError ? err.errors : [];
}

export function statusCode(err: unknown): number | null {
  return err instanceof ApiError ? err.statusCode : null;
}
