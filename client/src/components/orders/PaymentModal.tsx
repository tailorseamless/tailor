import { useRef, useState } from "react";
import { newOrderKey, useRecordPayment, useRefund } from "../../hooks/useOrders";
import { useWorkspace } from "../../hooks/useWorkspace";
import type { PaymentMethod } from "../../types/payment.types";
import { errorMessage } from "../../utils/errors";
import { formatMoney } from "../../utils/money";
import { PAYMENT_METHOD } from "../../utils/statusLabels";
import { localInputToIso, toLocalInput } from "../../utils/timezone";
import { Button } from "../shared/Button";
import { Field, FormError, Input, Select } from "../shared/Field";
import { Modal } from "../shared/Modal";

interface Props {
  open: boolean;
  onClose: () => void;
  orderId: string;
  kind: "payment" | "refund";
  /** Suggested amount: the balance for a payment, what's been paid for a refund. */
  suggested: number;
  max: number;
  /** What `max` is called in the "too much" hint: the balance, or what is left under an estimate. */
  limitLabel?: string;
}

export function PaymentModal({ open, onClose, orderId, kind, suggested, max, limitLabel = "balance" }: Props) {
  const { currency, timeZone } = useWorkspace();
  const pay = useRecordPayment(orderId);
  const refund = useRefund(orderId);
  const mutation = kind === "payment" ? pay : refund;
  const key = useRef(newOrderKey());
  const [amount, setAmount] = useState(suggested > 0 ? String(suggested) : "");
  const [method, setMethod] = useState<PaymentMethod>("cash");
  const [paidAt, setPaidAt] = useState(toLocalInput(new Date(), timeZone));
  const [reference, setReference] = useState("");
  const [note, setNote] = useState("");
  const [problem, setProblem] = useState<string | null>(null);

  const close = () => {
    mutation.reset();
    setProblem(null);
    onClose();
  };

  const save = () => {
    const value = Number(amount);
    if (!(value > 0)) return setProblem("Enter an amount above 0.");
    if (kind === "refund" && note.trim().length < 3) return setProblem("Say why you are refunding.");
    if (kind === "refund" && value > max) return setProblem(`You can refund at most ${formatMoney(max, currency)}.`);
    setProblem(null);
    mutation.mutate(
      {
        key: key.current,
        input: {
          amount: value,
          method,
          paidAt: localInputToIso(paidAt, timeZone),
          reference: reference.trim() || null,
          note: note.trim() || null,
        },
      },
      {
        onSuccess: () => {
          key.current = newOrderKey();
          close();
        },
      },
    );
  };

  const overpaying = kind === "payment" && Number(amount) > max && max >= 0;
  return (
    <Modal
      open={open}
      onClose={close}
      title={kind === "payment" ? "Record a payment" : "Record a refund"}
      size="sm"
      footer={
        <>
          <Button variant="secondary" onClick={close} data-cy="payment-cancel">
            Cancel
          </Button>
          <Button
            variant={kind === "refund" ? "danger" : "primary"}
            onClick={save}
            loading={mutation.isPending}
            data-cy="payment-save"
          >
            {kind === "payment" ? "Record payment" : "Record refund"}
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <FormError message={problem ?? (mutation.error ? errorMessage(mutation.error) : null)} />
        <Field
          label={`Amount (${currency})`}
          hint={overpaying ? `That's more than the ${formatMoney(max, currency)} ${limitLabel}.` : undefined}
        >
          {(p) => (
            <Input
              {...p}
              type="number"
              inputMode="decimal"
              min={0}
              step="any"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              data-cy="payment-amount"
            />
          )}
        </Field>
        <Field label="Method">
          {(p) => (
            <Select
              {...p}
              value={method}
              onChange={(e) => setMethod(e.target.value as PaymentMethod)}
              data-cy="payment-method"
            >
              {(Object.keys(PAYMENT_METHOD) as PaymentMethod[]).map((m) => (
                <option key={m} value={m}>
                  {PAYMENT_METHOD[m]}
                </option>
              ))}
            </Select>
          )}
        </Field>
        <Field label="When">
          {(p) => (
            <Input
              {...p}
              type="datetime-local"
              value={paidAt}
              max={toLocalInput(new Date(), timeZone)}
              onChange={(e) => setPaidAt(e.target.value)}
              data-cy="payment-date"
            />
          )}
        </Field>
        {method !== "cash" && (
          <Field label="Reference (optional)" hint="Transfer reference or POS slip number.">
            {(p) => (
              <Input
                {...p}
                value={reference}
                onChange={(e) => setReference(e.target.value)}
                maxLength={100}
                data-cy="payment-reference"
              />
            )}
          </Field>
        )}
        <Field label={kind === "refund" ? "Reason" : "Note (optional)"}>
          {(p) => (
            <Input
              {...p}
              value={note}
              onChange={(e) => setNote(e.target.value)}
              maxLength={500}
              data-cy="payment-note"
            />
          )}
        </Field>
      </div>
    </Modal>
  );
}
