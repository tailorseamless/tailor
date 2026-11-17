import { z } from "zod";
import { calendarDate } from "../../../shared/utils/zod";
import { DASHBOARD } from "../dto/dashboard.dto";

const DAY_MS = 86_400_000;

/** Both optional: the default is the current month so far. */
export const dashboardSchema = z.object({
  query: z
    .object({ from: calendarDate.optional(), to: calendarDate.optional(), branchId: z.string().uuid().optional() })
    .refine((query) => !query.from || !query.to || query.from <= query.to, {
      message: "Must not be before from",
      path: ["to"],
    })
    .refine(
      (query) =>
        !query.from || !query.to || (Date.parse(query.to) - Date.parse(query.from)) / DAY_MS < DASHBOARD.maxPeriodDays,
      { message: "Choose a period of at most one year", path: ["to"] },
    ),
});

export type DashboardQuery = z.infer<typeof dashboardSchema>["query"];
