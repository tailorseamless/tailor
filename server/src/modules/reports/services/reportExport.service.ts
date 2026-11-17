import { EXPORT } from "../../../config/constants";
import { toCsv, toXlsx, type ExportSheet, type ExportTable } from "../../../infrastructure/documents/exportWriter";
import { AppError } from "../../../shared/errors/AppError";
import type { Paginated } from "../../../shared/pagination/paginate";
import type { Actor } from "../../../shared/services/access.service";
import { localDateTime, PAYMENT_METHOD_LABELS } from "../../../shared/utils/format";
import { addDays, localDay, zonedMidnight } from "../../../shared/utils/timezone";
import { BranchRepository } from "../../branches/repositories/branch.repository";
import { BusinessRepository } from "../../businesses/repositories/business.repository";
import { resolvePeriod } from "../../dashboard/domain/dashboardFigures";
import { ExpenseService } from "../../expenses/services/expense.service";
import { OrderService } from "../../orders/services/order.service";
import { PaymentService } from "../../payments/services/payment.service";
import type { ExportFormat, ExportKey, ExportQuery } from "../validators/export.schema";
import { ReportService } from "./report.service";

const CONTENT_TYPES: Record<ExportFormat, string> = {
  xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  csv: "text/csv; charset=utf-8",
};

interface Scope {
  actor: Actor;
  from: string;
  to: string;
  timeZone: string;
  currency: string;
  branchId?: string;
  /** The period as instants: midnight of `from` to midnight after `to`, in the business's zone. */
  start: Date;
  end: Date;
}

/**
 * Reports as files (PRD US-053). Lists are read a page at a time and capped
 * at EXPORT.maxRows; the whole file is built before any byte is sent, so a
 * failure is still an ordinary JSON error. Times are wall-clock in the
 * business's zone, with the zone named in the notes (spreadsheets have no zones).
 */
export class ReportExportService {
  static Instance = new ReportExportService();

  private constructor(
    private readonly reports = ReportService.Instance,
    private readonly orders = OrderService.Instance,
    private readonly payments = PaymentService.Instance,
    private readonly expenses = ExpenseService.Instance,
    private readonly businesses = BusinessRepository.Instance,
    private readonly branches = BranchRepository.Instance,
  ) {}

  async export(
    actor: Actor,
    key: ExportKey,
    query: ExportQuery,
  ): Promise<{ filename: string; contentType: string; content: Buffer }> {
    const business = await this.businesses.findBusiness(actor.businessId);
    if (!business) throw AppError.notFound("Business not found");
    const branch = query.branchId ? await this.branches.findInBusiness(query.branchId, actor.businessId) : null;
    if (query.branchId && !branch) throw AppError.notFound("Branch not found");

    const period = resolvePeriod(localDay(new Date(), business.timeZone), query.from, query.to);
    const scope: Scope = {
      actor,
      ...period,
      timeZone: business.timeZone,
      currency: business.currency,
      branchId: query.branchId,
      start: zonedMidnight(period.from, business.timeZone),
      end: zonedMidnight(addDays(period.to, 1), business.timeZone),
    };

    const sheets = await this.sheets(key, scope);
    const truncated = sheets.some((sheet) => sheet.rows.length >= EXPORT.maxRows);
    const table: ExportTable = {
      title: `${business.name} — ${key.replace(/-/g, " ")}`,
      notes: [
        `Period: ${period.from} to ${period.to}`,
        `Times are in ${business.timeZone}. Amounts are in ${business.currency}.`,
        branch ? `Branch: ${branch.name}` : "All branches",
        `Exported ${localDateTime(new Date(), business.timeZone)}`,
        ...(truncated
          ? [`Only the first ${EXPORT.maxRows} rows are included. Choose a shorter period for the rest.`]
          : []),
      ],
      sheets,
    };

    const content = query.format === "csv" ? toCsv(table) : await toXlsx(table);
    return {
      filename: `tailorflow-${key}-${period.from}-to-${period.to}.${query.format}`,
      contentType: CONTENT_TYPES[query.format],
      content,
    };
  }

  private async sheets(key: ExportKey, scope: Scope): Promise<ExportSheet[]> {
    const { actor, from, to, branchId, timeZone } = scope;
    const period = { from, to, ...(branchId ? { branchId } : {}) };

    switch (key) {
      case "income-expenses": {
        const report = await this.reports.incomeAndExpenses(actor, period);
        return [
          {
            name: "Summary",
            columns: [
              { key: "metric", header: "Metric", type: "text" },
              { key: "value", header: "Amount", type: "money" },
            ],
            rows: [
              { metric: "Value of orders taken (not cash)", value: report.orderValue },
              { metric: "Payments received", value: report.received },
              { metric: "Refunds given", value: report.refunded },
              { metric: "Net received", value: report.netReceived },
              { metric: "Expenses", value: report.expenses.total },
              { metric: "Estimated profit (net received − expenses)", value: report.estimatedProfit },
            ],
          },
          {
            name: "By month",
            columns: [
              { key: "month", header: "Month", type: "text" },
              { key: "netReceived", header: "Net received", type: "money" },
              { key: "expenses", header: "Expenses", type: "money" },
              { key: "net", header: "Net", type: "money" },
            ],
            rows: report.byMonth.map((row) => ({ ...row })),
          },
          {
            name: "Expenses by category",
            columns: [
              { key: "category", header: "Category", type: "text" },
              { key: "count", header: "Entries", type: "number" },
              { key: "total", header: "Total", type: "money" },
            ],
            rows: report.expenses.byCategory.map((row) => ({ ...row })),
          },
        ];
      }

      case "garment-sales": {
        const report = await this.reports.garmentSales(actor, period);
        return [
          {
            name: "Garments",
            columns: [
              { key: "garmentName", header: "Garment", type: "text" },
              { key: "quantity", header: "Pieces", type: "number" },
              { key: "orders", header: "Orders", type: "number" },
              { key: "value", header: "Value", type: "money" },
            ],
            rows: report.garments.map((row) => ({ ...row })),
          },
        ];
      }

      case "orders": {
        const rows = await this.collect((page) =>
          this.orders.list(actor, {
            page,
            limit: EXPORT.pageSize,
            sort: "recent",
            from: scope.start,
            to: scope.end,
            branchId,
          }),
        );
        return [
          {
            name: "Orders",
            columns: [
              { key: "orderNumber", header: "Order", type: "text" },
              { key: "createdAt", header: "Taken", type: "datetime" },
              { key: "customerName", header: "Customer", type: "text" },
              { key: "customerPhone", header: "Phone", type: "text" },
              { key: "status", header: "Status", type: "text" },
              { key: "dueDate", header: "Due", type: "date" },
              { key: "totalAmount", header: "Total", type: "money" },
              { key: "amountPaid", header: "Paid", type: "money" },
              { key: "balance", header: "Balance", type: "money" },
            ],
            rows: rows.map((order) => ({
              ...order,
              createdAt: localDateTime(new Date(order.createdAt), timeZone),
              status: order.status.replace(/_/g, " "),
            })),
          },
        ];
      }

      case "payments": {
        const rows = await this.collect((page) =>
          this.payments.list(actor, { page, limit: EXPORT.pageSize, from: scope.start, to: scope.end, branchId }),
        );
        return [
          {
            name: "Payments",
            columns: [
              { key: "paidAt", header: "Date", type: "datetime" },
              { key: "receiptNumber", header: "Receipt", type: "text" },
              { key: "kind", header: "Kind", type: "text" },
              { key: "orderNumber", header: "Order", type: "text" },
              { key: "customerName", header: "Customer", type: "text" },
              { key: "method", header: "Method", type: "text" },
              { key: "reference", header: "Reference", type: "text" },
              { key: "amount", header: "Amount", type: "money" },
              { key: "voided", header: "Voided", type: "text" },
            ],
            rows: rows.map((payment) => ({
              ...payment,
              paidAt: localDateTime(new Date(payment.paidAt), timeZone),
              method: PAYMENT_METHOD_LABELS[payment.method] ?? payment.method,
              // Amounts are as recorded; `Kind` says which way the money moved, `Voided` that it no longer counts.
              voided: payment.voided ? "yes" : "",
            })),
          },
        ];
      }

      case "expenses": {
        const rows = await this.collect((page) =>
          this.expenses.list(actor, { page, limit: EXPORT.pageSize, from, to, branchId }),
        );
        return [
          {
            name: "Expenses",
            columns: [
              { key: "spentOn", header: "Date", type: "date" },
              { key: "category", header: "Category", type: "text" },
              { key: "description", header: "Description", type: "text" },
              { key: "method", header: "Method", type: "text" },
              { key: "reference", header: "Reference", type: "text" },
              { key: "amount", header: "Amount", type: "money" },
            ],
            rows: rows.map((expense) => ({
              ...expense,
              method: PAYMENT_METHOD_LABELS[expense.method] ?? expense.method,
            })),
          },
        ];
      }
    }
  }

  /** Reads page after page until the list ends or the row cap is reached. Memory stays bounded. */
  private async collect<T>(page: (n: number) => Promise<Paginated<T>>): Promise<T[]> {
    const rows: T[] = [];
    for (let n = 1; rows.length < EXPORT.maxRows; n += 1) {
      const result = await page(n);
      rows.push(...result.data);
      if (result.data.length < EXPORT.pageSize) break;
    }
    return rows.slice(0, EXPORT.maxRows);
  }
}
