import { BranchFilter, useBranchFilter } from "../../components/shared/BranchFilter";
import { CalendarDays, Plus, UserPlus } from "lucide-react";
import { Link } from "react-router-dom";
import { OrderRow } from "../../components/orders/OrderRow";
import { ButtonLink } from "../../components/shared/Button";
import { Badge, Card, PageHeader, StatCard } from "../../components/shared/Display";
import { EmptyState, QueryState } from "../../components/shared/States";
import { useDashboard } from "../../hooks/useAccount";
import { useWorkspace } from "../../hooks/useWorkspace";
import { formatDateTime, formatTime } from "../../utils/formatDate";
import { formatMoney } from "../../utils/money";
import { APPOINTMENT_TYPE, PAYMENT_METHOD } from "../../utils/statusLabels";

function greeting(): string {
  const hour = new Date().getHours();
  return hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening";
}

export default function DashboardPage() {
  const { me, timeZone, can } = useWorkspace();
  const [branchId, setBranchId] = useBranchFilter();
  const query = useDashboard({ branchId: branchId || undefined });
  const firstName = me.user.fullName.split(" ")[0];

  return (
    <>
      <PageHeader
        title={`${greeting()}, ${firstName}`}
        subtitle="Here's your workshop this month."
        actions={
          <>
            <BranchFilter value={branchId} onChange={setBranchId} />
            {can("customer.create") && (
              <ButtonLink
                to="/customers?new=1"
                variant="secondary"
                icon={<UserPlus className="size-4" aria-hidden />}
                data-cy="dash-new-customer"
              >
                Customer
              </ButtonLink>
            )}
            {can("order.create") && (
              <ButtonLink to="/orders/new" icon={<Plus className="size-4" aria-hidden />} data-cy="dash-new-order">
                New order
              </ButtonLink>
            )}
          </>
        }
      />
      <QueryState query={query} loadingLabel="Loading your dashboard">
        {(d) => {
          const money = (n: number) => formatMoney(n, d.currency);
          const showMoney = can("payment.read");
          return (
            <div className="space-y-5">
              <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
                <StatCard
                  label="In progress"
                  value={d.orders.pending + d.orders.inProgress}
                  hint={`${d.orders.createdInPeriod} new this month`}
                  to="/orders?filter=unfinished"
                />
                <StatCard
                  label="Ready"
                  value={d.orders.ready}
                  hint="Waiting for collection"
                  to="/orders?filter=ready"
                />
                <StatCard
                  label="Overdue"
                  value={d.orders.overdue}
                  tone={d.orders.overdue ? "danger" : "default"}
                  hint="Past the due date"
                  to="/orders?filter=overdue"
                />
                {showMoney ? (
                  <StatCard
                    label="Owed to you"
                    value={money(d.money.outstandingBalance)}
                    tone={d.money.outstandingBalance ? "warning" : "default"}
                    hint={`${d.money.ordersOwing} orders with a balance`}
                    to="/orders?filter=unpaid"
                  />
                ) : (
                  <StatCard
                    label="Customers"
                    value={d.customers.total}
                    hint={`${d.customers.newInPeriod} new this month`}
                    to="/customers"
                  />
                )}
              </div>

              {showMoney && (
                <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
                  <StatCard
                    label="Received this month"
                    value={money(d.money.netReceivedInPeriod)}
                    hint={d.money.refundedInPeriod ? `After ${money(d.money.refundedInPeriod)} refunded` : undefined}
                  />
                  <StatCard
                    label="Orders this month"
                    value={money(d.money.orderValueInPeriod)}
                    hint={`${d.orders.createdInPeriod} orders`}
                  />
                  <StatCard label="Delivered" value={d.orders.deliveredInPeriod} hint="This month" />
                  <StatCard
                    label="Customers"
                    value={d.customers.total}
                    hint={`${d.customers.newInPeriod} new this month`}
                    to="/customers"
                  />
                </div>
              )}

              <div className="grid gap-5 lg:grid-cols-2">
                <Card
                  title="Due soon"
                  action={
                    <Link to="/orders?filter=unfinished" className="text-sm text-link hover:underline">
                      All orders
                    </Link>
                  }
                >
                  {d.dueSoon.length ? (
                    <ul className="divide-y divide-line">
                      {d.dueSoon.map((o) => (
                        <OrderRow key={o.id} order={o} />
                      ))}
                    </ul>
                  ) : (
                    <EmptyState title="Nothing due in the next week" />
                  )}
                </Card>

                <Card
                  title={`Today · ${d.appointments.todayCount} appointment${d.appointments.todayCount === 1 ? "" : "s"}`}
                  action={
                    <Link to="/appointments" className="text-sm text-link hover:underline">
                      Diary
                    </Link>
                  }
                >
                  {d.appointments.today.length || d.appointments.upcoming.length ? (
                    <ul className="divide-y divide-line">
                      {[
                        ...d.appointments.today,
                        ...d.appointments.upcoming.filter((u) => !d.appointments.today.some((t) => t.id === u.id)),
                      ]
                        .slice(0, 6)
                        .map((a) => (
                          <li key={a.id} className="flex items-center gap-3 px-4 py-3">
                            <CalendarDays className="size-4 text-fg-subtle" aria-hidden />
                            <div className="min-w-0 flex-1">
                              <p className="truncate text-sm font-medium text-fg">{a.customerName}</p>
                              <p className="text-xs text-fg-muted">{APPOINTMENT_TYPE[a.type]}</p>
                            </div>
                            <span className="text-sm text-fg-muted tabular-nums">
                              {d.appointments.today.includes(a)
                                ? formatTime(a.startsAt, timeZone)
                                : formatDateTime(a.startsAt, timeZone)}
                            </span>
                          </li>
                        ))}
                    </ul>
                  ) : (
                    <EmptyState title="No appointments booked" />
                  )}
                </Card>

                <Card title="Recent orders">
                  {d.recentOrders.length ? (
                    <ul className="divide-y divide-line">
                      {d.recentOrders.map((o) => (
                        <OrderRow key={o.id} order={o} />
                      ))}
                    </ul>
                  ) : (
                    <EmptyState title="No orders yet" message="Create your first order to start tracking work." />
                  )}
                </Card>

                {showMoney && (
                  <Card title="Recent payments">
                    {d.recentPayments.length ? (
                      <ul className="divide-y divide-line">
                        {d.recentPayments.map((p) => (
                          <li key={p.id}>
                            <Link
                              to={`/orders/${p.orderId}`}
                              className="flex items-center gap-3 px-4 py-3 hover:bg-subtle"
                            >
                              <div className="min-w-0 flex-1">
                                <p className="truncate text-sm font-medium text-fg">{p.customerName}</p>
                                <p className="text-xs text-fg-muted">
                                  {p.orderNumber} · {PAYMENT_METHOD[p.method]} · {formatDateTime(p.paidAt, timeZone)}
                                </p>
                              </div>
                              {p.voided ? <Badge>Voided</Badge> : null}
                              <span
                                className={
                                  p.kind === "refund"
                                    ? "text-sm text-danger-fg tabular-nums"
                                    : "text-sm font-medium text-fg tabular-nums"
                                }
                              >
                                {p.kind === "refund" ? "−" : ""}
                                {money(p.amount)}
                              </span>
                            </Link>
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <EmptyState title="No payments yet" />
                    )}
                  </Card>
                )}
              </div>
            </div>
          );
        }}
      </QueryState>
    </>
  );
}
