import { AppError } from "../../../shared/errors/AppError";
import type { Actor } from "../../../shared/services/access.service";
import { addMoney, subtractMoney } from "../../../shared/utils/money";
import { localDay } from "../../../shared/utils/timezone";
import { BusinessRepository } from "../../businesses/repositories/business.repository";
import { orderValueInPeriod, resolvePeriod } from "../../dashboard/domain/dashboardFigures";
import { DashboardRepository } from "../../dashboard/repositories/dashboard.repository";
import type { DashboardQuery } from "../../dashboard/validators/dashboard.schema";
import { ExpenseRepository } from "../../expenses/repositories/expense.repository";
import { mergeMonths } from "../domain/reportFigures";
import type { GarmentSalesDTO, IncomeExpensesDTO, PeriodArgs } from "../dto/report.dto";
import { ReportRepository } from "../repositories/report.repository";

export class ReportService {
  static Instance = new ReportService();

  private constructor(
    private readonly reports = ReportRepository.Instance,
    private readonly figures = DashboardRepository.Instance,
    private readonly expenses = ExpenseRepository.Instance,
    private readonly businesses = BusinessRepository.Instance,
  ) {}

  /** Money in, money out and what is left, for a period (default: this month so far). */
  async incomeAndExpenses(actor: Actor, query: DashboardQuery): Promise<IncomeExpensesDTO> {
    const { params, currency, today } = await this.scope(actor, query);

    const [cash, statusRows, byCategory, cashByMonth, expensesByMonth] = await Promise.all([
      this.figures.paymentsInPeriod(params),
      this.figures.orderStatusRows(params, today),
      this.expenses.totalsByCategory(params.businessId, params.from, params.to, params.branchId),
      this.reports.cashByMonth(params),
      this.reports.expensesByMonth(params),
    ]);

    const netReceived = subtractMoney(cash.received, cash.refunded);
    const totalExpenses = byCategory.reduce((sum, row) => addMoney(sum, row.total), 0);
    return {
      period: { from: params.from, to: params.to, timeZone: params.timeZone },
      currency,
      orderValue: orderValueInPeriod(statusRows),
      received: cash.received,
      refunded: cash.refunded,
      netReceived,
      expenses: { total: totalExpenses, byCategory },
      estimatedProfit: subtractMoney(netReceived, totalExpenses),
      byMonth: mergeMonths(cashByMonth, expensesByMonth),
    };
  }

  /** The garments that bring in the most, from orders taken in the period. */
  async garmentSales(actor: Actor, query: DashboardQuery): Promise<GarmentSalesDTO> {
    const { params, currency } = await this.scope(actor, query);
    return {
      period: { from: params.from, to: params.to, timeZone: params.timeZone },
      currency,
      garments: await this.reports.garmentSales(params),
    };
  }

  /** Tenant and period, both from the caller's own business — never from the client. */
  private async scope(
    actor: Actor,
    query: DashboardQuery,
  ): Promise<{ params: PeriodArgs; currency: string; today: string }> {
    const business = await this.businesses.findBusiness(actor.businessId);
    if (!business) throw AppError.notFound("Business not found");
    const today = localDay(new Date(), business.timeZone);
    return {
      params: {
        businessId: actor.businessId,
        branchId: query.branchId ?? null,
        ...resolvePeriod(today, query.from, query.to),
        timeZone: business.timeZone,
      },
      currency: business.currency,
      today,
    };
  }
}
