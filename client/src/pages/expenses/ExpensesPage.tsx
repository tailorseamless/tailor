import { BranchField, BranchFilter, defaultBranch, useBranchFilter } from "../../components/shared/BranchFilter";
import { Pencil, Plus, Receipt, Trash2 } from "lucide-react";
import { useRef, useState } from "react";
import { Button, IconButton } from "../../components/shared/Button";
import { DatePicker } from "../../components/shared/DatePicker";
import { Card, PageHeader, Pagination } from "../../components/shared/Display";
import { Field, FormError, Input, Select } from "../../components/shared/Field";
import { ConfirmDialog, Modal } from "../../components/shared/Modal";
import { EmptyState, QueryState } from "../../components/shared/States";
import { newRequestKey, useExpenseActions, useExpenses } from "../../hooks/useOperations";
import { useWorkspace } from "../../hooks/useWorkspace";
import type { PaymentMethod } from "../../types/payment.types";
import type { Expense, ExpenseCategory } from "../../types/workspace.types";
import { errorMessage } from "../../utils/errors";
import { formatDay } from "../../utils/formatDate";
import { EXPENSE_CATEGORY, keysOf } from "../../utils/labels";
import { formatMoney } from "../../utils/money";
import { PAYMENT_METHOD } from "../../utils/statusLabels";
import { todayIn } from "../../utils/timezone";

/** First and last day of the month containing `day`. */
function monthRange(month: string) {
  const [y, m] = month.split("-").map(Number);
  const last = new Date(Date.UTC(y, m, 0)).getUTCDate();
  return { from: `${month}-01`, to: `${month}-${String(last).padStart(2, "0")}` };
}

export default function ExpensesPage() {
  const { can, timeZone, currency } = useWorkspace();
  const [month, setMonth] = useState(todayIn(timeZone).slice(0, 7));
  const [category, setCategory] = useState<ExpenseCategory | "">("");
  const [page, setPage] = useState(1);
  const [editing, setEditing] = useState<Expense | "new" | null>(null);
  const [removing, setRemoving] = useState<Expense | null>(null);
  const [branchId, setBranchId] = useBranchFilter();
  const query = useExpenses({
    ...monthRange(month),
    category: category || undefined,
    branchId: branchId || undefined,
    page,
    limit: 50,
  });
  const { remove } = useExpenseActions();
  const canManage = can("expense.manage");
  const pageTotal = (query.data?.data ?? []).reduce((sum, e) => sum + e.amount, 0);

  return (
    <>
      <PageHeader
        title="Expenses"
        subtitle="What the business spends, for your profit report."
        actions={
          canManage && (
            <Button
              icon={<Plus className="size-4" aria-hidden />}
              onClick={() => setEditing("new")}
              data-cy="expense-new"
            >
              Record expense
            </Button>
          )
        }
      />
      <div className="mb-4 flex flex-wrap gap-3">
        <BranchFilter value={branchId} onChange={setBranchId} />
        <input
          type="month"
          className="control w-auto"
          value={month}
          onChange={(e) => {
            if (e.target.value) setMonth(e.target.value);
            setPage(1);
          }}
          aria-label="Month"
          data-cy="expenses-month"
        />
        <select
          className="control w-auto"
          value={category}
          onChange={(e) => {
            setCategory(e.target.value as ExpenseCategory | "");
            setPage(1);
          }}
          aria-label="Category"
          data-cy="expenses-category"
        >
          <option value="">All categories</option>
          {keysOf(EXPENSE_CATEGORY).map((c) => (
            <option key={c} value={c}>
              {EXPENSE_CATEGORY[c]}
            </option>
          ))}
        </select>
      </div>
      <Card>
        <QueryState query={query} loadingLabel="Loading expenses">
          {({ data, meta }) =>
            data.length ? (
              <>
                <ul className="divide-y divide-line">
                  {data.map((e) => (
                    <li key={e.id} className="flex items-center gap-3 px-4 py-3" data-cy="expense-row">
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium text-fg">{e.description}</p>
                        <p className="text-xs text-fg-muted">
                          {formatDay(e.spentOn)} · {EXPENSE_CATEGORY[e.category]} · {PAYMENT_METHOD[e.method]}
                          {e.reference && ` · ${e.reference}`}
                        </p>
                      </div>
                      <span className="text-sm font-medium text-fg tabular-nums">
                        {formatMoney(e.amount, currency)}
                      </span>
                      {canManage && (
                        <>
                          <IconButton label="Edit expense" onClick={() => setEditing(e)} data-cy="expense-edit">
                            <Pencil className="size-4" aria-hidden />
                          </IconButton>
                          <IconButton label="Delete expense" onClick={() => setRemoving(e)} data-cy="expense-delete">
                            <Trash2 className="size-4" aria-hidden />
                          </IconButton>
                        </>
                      )}
                    </li>
                  ))}
                </ul>
                {meta && meta.totalPages <= 1 && (
                  <p className="flex justify-between border-t border-line px-4 py-3 text-sm">
                    <span className="text-fg-muted">Total</span>
                    <span className="font-semibold text-fg tabular-nums" data-cy="expenses-total">
                      {formatMoney(pageTotal, currency)}
                    </span>
                  </p>
                )}
                <Pagination meta={meta} onPage={setPage} />
              </>
            ) : (
              <EmptyState icon={<Receipt className="size-6" aria-hidden />} title="No expenses this month" />
            )
          }
        </QueryState>
      </Card>
      {editing && <ExpenseForm expense={editing === "new" ? undefined : editing} onClose={() => setEditing(null)} />}
      <ConfirmDialog
        open={removing !== null}
        onClose={() => setRemoving(null)}
        onConfirm={() => removing && remove.mutate(removing.id, { onSuccess: () => setRemoving(null) })}
        title="Delete this expense?"
        message={removing ? `${removing.description}, ${formatMoney(removing.amount, currency)}` : undefined}
        confirmLabel="Delete"
        danger
        loading={remove.isPending}
      />
    </>
  );
}

function ExpenseForm({ expense, onClose }: { expense?: Expense; onClose: () => void }) {
  const { timeZone, currency } = useWorkspace();
  const { create, update } = useExpenseActions();
  const mutation = expense ? update : create;
  const key = useRef(newRequestKey());
  const [description, setDescription] = useState(expense?.description ?? "");
  const [amount, setAmount] = useState(expense?.amount.toString() ?? "");
  const [category, setCategory] = useState<ExpenseCategory>(expense?.category ?? "materials");
  const [spentOn, setSpentOn] = useState(expense?.spentOn ?? todayIn(timeZone));
  const [method, setMethod] = useState<PaymentMethod>(expense?.method ?? "cash");
  const [reference, setReference] = useState(expense?.reference ?? "");
  const [branchId, setBranchId] = useState(expense ? (expense.branchId ?? "") : defaultBranch());
  const [problem, setProblem] = useState<string | null>(null);

  const save = () => {
    setProblem(null);
    if (description.trim().length < 2) return setProblem("Say what it was for.");
    if (!(Number(amount) > 0)) return setProblem("Enter an amount above 0.");
    const input = {
      description: description.trim(),
      amount: Number(amount),
      category,
      spentOn,
      method,
      reference: reference.trim() || null,
      branchId: branchId || null,
    };
    if (expense) update.mutate({ id: expense.id, input }, { onSuccess: onClose });
    else create.mutate({ input, key: key.current }, { onSuccess: onClose });
  };

  return (
    <Modal
      open
      onClose={onClose}
      title={expense ? "Edit expense" : "Record an expense"}
      size="sm"
      footer={
        <>
          <Button variant="secondary" onClick={onClose} data-cy="expense-cancel">
            Cancel
          </Button>
          <Button onClick={save} loading={mutation.isPending} data-cy="expense-save">
            Save
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <FormError message={problem ?? (mutation.error ? errorMessage(mutation.error) : null)} />
        <Field label="What for">
          {(p) => (
            <Input
              {...p}
              placeholder="e.g. Generator diesel"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              data-cy="expense-description"
            />
          )}
        </Field>
        <div className="grid grid-cols-2 gap-4">
          <Field label={`Amount (${currency})`}>
            {(p) => (
              <Input
                {...p}
                type="number"
                inputMode="decimal"
                min={0}
                step="any"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                data-cy="expense-amount"
              />
            )}
          </Field>
          <Field label="Date">
            {(p) => (
              <DatePicker
                {...p}
                value={spentOn}
                onChange={setSpentOn}
                max={todayIn(timeZone)}
                timeZone={timeZone}
                clearable={false}
                data-cy="expense-date"
              />
            )}
          </Field>
          <Field label="Category">
            {(p) => (
              <Select
                {...p}
                value={category}
                onChange={(e) => setCategory(e.target.value as ExpenseCategory)}
                data-cy="expense-category"
              >
                {keysOf(EXPENSE_CATEGORY).map((c) => (
                  <option key={c} value={c}>
                    {EXPENSE_CATEGORY[c]}
                  </option>
                ))}
              </Select>
            )}
          </Field>
          <Field label="Paid by">
            {(p) => (
              <Select
                {...p}
                value={method}
                onChange={(e) => setMethod(e.target.value as PaymentMethod)}
                data-cy="expense-method"
              >
                {keysOf(PAYMENT_METHOD).map((m) => (
                  <option key={m} value={m}>
                    {PAYMENT_METHOD[m]}
                  </option>
                ))}
              </Select>
            )}
          </Field>
        </div>
        <BranchField value={branchId} onChange={setBranchId} dataCy="expense-branch" />
        <Field label="Reference (optional)">
          {(p) => (
            <Input
              {...p}
              value={reference}
              onChange={(e) => setReference(e.target.value)}
              maxLength={100}
              data-cy="expense-reference"
            />
          )}
        </Field>
      </div>
    </Modal>
  );
}
