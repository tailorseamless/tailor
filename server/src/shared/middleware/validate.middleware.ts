import type { NextFunction, Request, Response } from "express";
import type { ZodError, ZodTypeAny } from "zod";
import { ApiResponse, type FieldError } from "../response/apiResponse";

/** Drops the leading "body" / "query" / "params" segment: `{ field: "name", message }`. */
export function formatZodErrors(error: ZodError): FieldError[] {
  return error.issues.map((issue) => {
    const [first, ...rest] = issue.path;
    const path = first === "body" || first === "query" || first === "params" ? rest : issue.path;
    return { field: path.join(".") || String(first ?? ""), message: issue.message };
  });
}

/**
 * Validation is middleware: it runs before the controller body (Backend Guide §4).
 * A failure is 422 with `errors: [{ field, message }]`.
 */
export const validate =
  (schema: ZodTypeAny) =>
  (req: Request, res: Response, next: NextFunction): void => {
    const result = schema.safeParse({ body: req.body ?? {}, query: req.query ?? {}, params: req.params ?? {} });
    if (!result.success) {
      res.status(422).json(ApiResponse.error("Validation failed", 422, formatZodErrors(result.error)));
      return;
    }
    req.validated = result.data;
    next();
  };
