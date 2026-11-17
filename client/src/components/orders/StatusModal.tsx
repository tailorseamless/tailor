import { useState } from "react";
import { useChangeOrderStatus } from "../../hooks/useOrders";
import type { OrderStatus } from "../../types/order.types";
import { cn } from "../../utils/cn";
import { nextStatuses, ORDER_STATUS } from "../../utils/statusLabels";
import { Button } from "../shared/Button";
import { Field, Textarea } from "../shared/Field";
import { Modal } from "../shared/Modal";

export function StatusModal({
  open,
  onClose,
  orderId,
  current,
}: {
  open: boolean;
  onClose: () => void;
  orderId: string;
  current: OrderStatus;
}) {
  const change = useChangeOrderStatus(orderId);
  const options = nextStatuses(current);
  const [picked, setPicked] = useState<OrderStatus | null>(null);
  const [note, setNote] = useState("");

  const close = () => {
    setPicked(null);
    setNote("");
    onClose();
  };

  return (
    <Modal
      open={open}
      onClose={close}
      title="Update status"
      description={`Now: ${ORDER_STATUS[current].label}`}
      footer={
        <>
          <Button variant="secondary" onClick={close} data-cy="status-cancel">
            Cancel
          </Button>
          <Button
            variant={picked === "cancelled" ? "danger" : "primary"}
            disabled={!picked}
            loading={change.isPending}
            onClick={() =>
              picked && change.mutate({ status: picked, note: note.trim() || undefined }, { onSuccess: close })
            }
            data-cy="status-save"
          >
            {picked === "cancelled" ? "Cancel order" : "Update"}
          </Button>
        </>
      }
    >
      <div className="grid grid-cols-2 gap-2" role="radiogroup" aria-label="New status">
        {options.map((status) => (
          <button
            key={status}
            type="button"
            role="radio"
            aria-checked={picked === status}
            onClick={() => setPicked(status)}
            data-cy={`status-${status}`}
            className={cn(
              "rounded-lg border px-3 py-2 text-left text-sm",
              picked === status ? "border-brand bg-brand-soft font-medium text-link" : "border-line hover:bg-subtle",
              status === "cancelled" && picked !== status && "text-danger-fg",
            )}
          >
            {ORDER_STATUS[status].label}
          </button>
        ))}
      </div>
      <Field label="Note (optional)" className="mt-4">
        {(p) => (
          <Textarea
            {...p}
            rows={2}
            value={note}
            onChange={(e) => setNote(e.target.value)}
            maxLength={500}
            data-cy="status-note"
          />
        )}
      </Field>
    </Modal>
  );
}
