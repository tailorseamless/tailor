import * as Dialog from "@radix-ui/react-dialog";
import { X } from "lucide-react";
import { useState, type ReactNode } from "react";
import { cn } from "../../utils/cn";
import { Button } from "./Button";
import { Field, Input, Textarea } from "./Field";

interface ModalProps {
  open: boolean;
  onClose: () => void;
  title: string;
  description?: string;
  children: ReactNode;
  footer?: ReactNode;
  /** A tool that stays put above the footer while the body scrolls, e.g. a calculator. */
  dock?: ReactNode;
  size?: "sm" | "md" | "lg";
}

const widths = { sm: "max-w-sm", md: "max-w-lg", lg: "max-w-2xl" } as const;

/** Bottom sheet on phones, centred dialog on larger screens. */
export function Modal({ open, onClose, title, description, children, footer, dock, size = "md" }: ModalProps) {
  return (
    <Dialog.Root open={open} onOpenChange={(next) => !next && onClose()}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-black/40 backdrop-blur-[1px]" />
        <Dialog.Content
          className={cn(
            "fixed inset-x-0 bottom-0 z-50 flex max-h-[92dvh] flex-col rounded-t-2xl bg-surface shadow-modal",
            "sm:inset-auto sm:top-1/2 sm:left-1/2 sm:w-[calc(100%-2rem)] sm:-translate-x-1/2 sm:-translate-y-1/2 sm:rounded-2xl",
            widths[size],
          )}
        >
          <div className="flex items-start justify-between gap-4 border-b border-line px-5 py-4">
            <div>
              <Dialog.Title className="font-display text-lg font-semibold text-fg">{title}</Dialog.Title>
              {description ? (
                <Dialog.Description className="mt-1 text-sm text-fg-muted">{description}</Dialog.Description>
              ) : (
                <Dialog.Description className="sr-only">{title}</Dialog.Description>
              )}
            </div>
            <Dialog.Close
              className="rounded-lg p-1.5 text-fg-muted hover:bg-subtle hover:text-fg"
              aria-label="Close"
              data-cy="modal-close"
            >
              <X className="size-5" aria-hidden />
            </Dialog.Close>
          </div>
          <div className="flex-1 overflow-y-auto px-5 py-4">{children}</div>
          {dock && <div className="shrink-0 border-t border-line bg-subtle px-5 py-3">{dock}</div>}
          {footer && (
            <div className="flex flex-col-reverse gap-2 border-t border-line px-5 py-3 sm:flex-row sm:justify-end">
              {footer}
            </div>
          )}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

interface ConfirmProps {
  open: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  message: ReactNode;
  confirmLabel?: string;
  danger?: boolean;
  loading?: boolean;
}

export function ConfirmDialog({
  open,
  onClose,
  onConfirm,
  title,
  message,
  confirmLabel = "Confirm",
  danger,
  loading,
}: ConfirmProps) {
  return (
    <Modal
      open={open}
      onClose={onClose}
      title={title}
      size="sm"
      footer={
        <>
          <Button variant="secondary" onClick={onClose} data-cy="confirm-cancel">
            Cancel
          </Button>
          <Button variant={danger ? "danger" : "primary"} onClick={onConfirm} loading={loading} data-cy="confirm-ok">
            {confirmLabel}
          </Button>
        </>
      }
    >
      <div className="text-sm text-fg-muted">{message}</div>
    </Modal>
  );
}

interface PromptProps {
  open: boolean;
  onClose: () => void;
  onSubmit: (value: string) => void;
  title: string;
  label: string;
  message?: ReactNode;
  confirmLabel?: string;
  required?: boolean;
  /** The text must be at least this long (implies `required`). */
  minLength?: number;
  /** For drastic actions: the person must also type this exactly (a business's name) to go ahead. */
  confirmText?: string;
  danger?: boolean;
  loading?: boolean;
}

/** Asks for one line of text (a reason, a note). Replaces window.prompt. */
export function PromptDialog({
  open,
  onClose,
  onSubmit,
  title,
  label,
  message,
  confirmLabel = "Save",
  required,
  minLength,
  confirmText,
  danger,
  loading,
}: PromptProps) {
  const [value, setValue] = useState("");
  const [typed, setTyped] = useState("");
  const close = () => {
    setValue("");
    setTyped("");
    onClose();
  };
  const needed = minLength ?? (required ? 1 : 0);
  const short = value.trim().length < needed;
  const unconfirmed = confirmText !== undefined && typed.trim() !== confirmText.trim();
  return (
    <Modal
      open={open}
      onClose={close}
      title={title}
      size="sm"
      footer={
        <>
          <Button variant="secondary" onClick={close} data-cy="prompt-cancel">
            Cancel
          </Button>
          <Button
            variant={danger ? "danger" : "primary"}
            disabled={short || unconfirmed}
            loading={loading}
            onClick={() => onSubmit(value.trim())}
            data-cy="prompt-ok"
          >
            {confirmLabel}
          </Button>
        </>
      }
    >
      {message && <div className="mb-3 text-sm text-fg-muted">{message}</div>}
      <div className="space-y-4">
        <Field
          label={needed ? label : `${label} (optional)`}
          hint={minLength ? `At least ${minLength} characters.` : undefined}
        >
          {(p) => (
            <Textarea
              {...p}
              value={value}
              onChange={(e) => setValue(e.target.value)}
              maxLength={500}
              data-cy="prompt-input"
            />
          )}
        </Field>
        {confirmText !== undefined && (
          <Field label={`Type "${confirmText}" to confirm`}>
            {(p) => (
              <Input
                {...p}
                value={typed}
                onChange={(e) => setTyped(e.target.value)}
                autoComplete="off"
                data-cy="prompt-confirm"
              />
            )}
          </Field>
        )}
      </div>
    </Modal>
  );
}
