import { AppError } from "../../../shared/errors/AppError";
import type { Actor } from "../../../shared/services/access.service";
import { subtractMoney } from "../../../shared/utils/money";
import { addDays, localDay } from "../../../shared/utils/timezone";
import { AppointmentService } from "../../appointments/services/appointment.service";
import { BusinessRepository } from "../../businesses/repositories/business.repository";
import { OrderService } from "../../orders/services/order.service";
import { PaymentService } from "../../payments/services/payment.service";
import { orderValueInPeriod, resolvePeriod, summariseOrders } from "../domain/dashboardFigures";
import { DASHBOARD, type DashboardDTO } from "../dto/dashboard.dto";
import { DashboardRepository } from "../repositories/dashboard.repository";
import type { DashboardQuery } from "../validators/dashboard.schema";

export class DashboardService {
  static Instance = new DashboardService();

  private constructor(
    private readonly dashboard = DashboardRepository.Instance,
    private readonly businesses = BusinessRepository.Instance,
    private readonly orders = OrderService.Instance,
    private readonly payments = PaymentService.Instance,
    private readonly appointments = AppointmentService.Instance,
  ) {}

  /** The business at a glance (PRD §4.1). "Today" and the period are in the BUSINESS's time zone. */
  async overview(actor: Actor, query: DashboardQuery): Promise<DashboardDTO> {
    const business = await this.businesses.findBusiness(actor.businessId);
    if (!business) throw AppError.notFound("Business not found");

    const today = localDay(new Date(), business.timeZone);
    const period = { ...resolvePeriod(today, query.from, query.to), timeZone: business.timeZone };
    const branchId = query.branchId ?? null;
    const params = { businessId: actor.businessId, branchId, ...period }; // tenant scope, always
    const branch = query.branchId ? { branchId: query.branchId } : {};
    const list = { page: 1, limit: DASHBOARD.listSize };

    // The diary's "today" is the business's day, like everything else here.
    const inBusinessZone = { ...actor, timeZone: business.timeZone };

    const [
      customers,
      statusRows,
      cash,
      outstanding,
      recentOrders,
      dueSoon,
      recentPayments,
      todayAppointments,
      upcomingAppointments,
    ] = await Promise.all([
      this.dashboard.customerCounts(params),
      this.dashboard.orderStatusRows(params, today),
      this.dashboard.paymentsInPeriod(params),
      this.dashboard.outstanding(actor.businessId, branchId),
      this.orders.list(actor, { ...list, ...branch, sort: "recent" }),
      this.orders.list(actor, {
        ...list,
        ...branch,
        sort: "due",
        unfinished: true,
        dueFrom: today,
        dueTo: addDays(today, DASHBOARD.dueSoonDays),
      }),
      this.payments.list(actor, { ...list, ...branch }),
      this.appointments.list(inBusinessZone, {
        page: 1,
        limit: DASHBOARD.todayListSize,
        order: "asc",
        day: today,
        ...branch,
      }),
      this.appointments.list(inBusinessZone, {
        ...list,
        order: "asc",
        status: "scheduled",
        from: new Date(),
        ...branch,
      }),
    ]);

    return {
      period,
      currency: business.currency,
      customers,
      orders: summariseOrders(statusRows),
      money: {
        orderValueInPeriod: orderValueInPeriod(statusRows),
        receivedInPeriod: cash.received,
        refundedInPeriod: cash.refunded,
        netReceivedInPeriod: subtractMoney(cash.received, cash.refunded),
        outstandingBalance: outstanding.balance,
        ordersOwing: outstanding.orders,
      },
      recentOrders: recentOrders.data,
      dueSoon: dueSoon.data,
      recentPayments: recentPayments.data,
      appointments: {
        todayCount: todayAppointments.meta.total,
        today: todayAppointments.data,
        upcoming: upcomingAppointments.data,
      },
    };
  }
}
