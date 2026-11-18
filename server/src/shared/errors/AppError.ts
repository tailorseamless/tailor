import type { FieldError } from "../response/apiResponse";

/** A domain error whose message is safe to show to the client (Backend Guide §12.1). */
export class AppError extends Error {
  constructor(
    public readonly message: string,
    public readonly statusCode = 400,
    public readonly errors: unknown[] = [],
  ) {
    super(message);
    this.name = "AppError";
    Error.captureStackTrace?.(this, AppError);
  }

  static badRequest(message: string, errors: unknown[] = []) {
    return new AppError(message, 400, errors);
  }
  static unauthorised(message = "Unauthorised", errors: unknown[] = []) {
    return new AppError(message, 401, errors);
  }
  static forbidden(message = "Forbidden") {
    return new AppError(message, 403);
  }
  /** Also for records the caller may not access — existence must not leak. */
  static notFound(message = "Not found", errors: unknown[] = []) {
    return new AppError(message, 404, errors);
  }
  static conflict(message: string, errors: unknown[] = []) {
    return new AppError(message, 409, errors);
  }
  static gone(message: string) {
    return new AppError(message, 410);
  }
  static unprocessable(message: string, errors: FieldError[] = []) {
    return new AppError(message, 422, errors);
  }
  /** A dependency is switched off or not configured. */
  static unavailable(message: string) {
    return new AppError(message, 503);
  }
}
