import { z } from "zod";
import { calendarDate } from "../../../shared/utils/zod";

const DAY_MS = 86_400_000;
const MAX_DAYS = 366;

/** What can be exported (PRD US-053). */
export const EXPORT_KEYS = ["income-expenses", "garment-sales", "orders", "payments", "expenses"] as const;
export type ExportKey = (typeof EXPORT_KEYS)[number];

export const EXPORT_FORMATS = ["xlsx", "csv"] as const;
export type ExportFormat = (typeof EXPORT_FORMATS)[number];

/** The same period as the dashboard and reports (default: this month so far), plus the file format. */
export const exportSchema = z.object({
  params: z.object({ key: z.enum(EXPORT_KEYS) }),
  query: z
    .object({
      from: calendarDate.optional(),
      to: calendarDate.optional(),
      branchId: z.string().uuid().optional(),
      format: z.enum(EXPORT_FORMATS).default("xlsx"),
    })
    .refine((query) => !query.from || !query.to || query.from <= query.to, {
      message: "Must not be before from",
      path: ["to"],
    })
    .refine(
      (query) => !query.from || !query.to || (Date.parse(query.to) - Date.parse(query.from)) / DAY_MS < MAX_DAYS,
      { message: "Choose a period of at most one year", path: ["to"] },
    ),
});

export type ExportQuery = z.infer<typeof exportSchema>["query"];
