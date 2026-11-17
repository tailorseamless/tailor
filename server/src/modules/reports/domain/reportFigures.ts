import { subtractMoney } from "../../../shared/utils/money";
import type { MonthFigures } from "../dto/report.dto";

/** Merging per-month series into one — pure, no I/O. */
export function mergeMonths(
  cash: { month: string; netReceived: number }[],
  spending: { month: string; expenses: number }[],
): MonthFigures[] {
  const months = new Map<string, MonthFigures>();
  const at = (month: string) => {
    let row = months.get(month);
    if (!row) months.set(month, (row = { month, netReceived: 0, expenses: 0, net: 0 }));
    return row;
  };
  for (const row of cash) at(row.month).netReceived = row.netReceived;
  for (const row of spending) at(row.month).expenses = row.expenses;

  return [...months.values()]
    .map((row) => ({ ...row, net: subtractMoney(row.netReceived, row.expenses) }))
    .sort((a, b) => a.month.localeCompare(b.month));
}
