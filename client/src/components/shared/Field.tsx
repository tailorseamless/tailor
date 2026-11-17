import {
  useId,
  type InputHTMLAttributes,
  type ReactNode,
  type Ref,
  type SelectHTMLAttributes,
  type TextareaHTMLAttributes,
} from "react";
import { cn } from "../../utils/cn";

interface FieldProps {
  label: string;
  error?: string;
  hint?: ReactNode;
  className?: string;
  /** Renders the control; receives the id and aria props to spread on it. */
  children: (props: { id: string; "aria-invalid"?: boolean; "aria-describedby"?: string }) => ReactNode;
}

/** Label + control + hint/error, wired for screen readers. */
export function Field({ label, error, hint, className, children }: FieldProps) {
  const id = useId();
  const describedBy = error ? `${id}-error` : hint ? `${id}-hint` : undefined;
  return (
    <div className={cn("space-y-1.5", className)}>
      <label htmlFor={id} className="block text-sm font-medium text-fg">
        {label}
      </label>
      {children({ id, "aria-invalid": error ? true : undefined, "aria-describedby": describedBy })}
      {error ? (
        <p id={`${id}-error`} className="text-sm text-danger-fg">
          {error}
        </p>
      ) : hint ? (
        <p id={`${id}-hint`} className="text-xs text-fg-subtle">
          {hint}
        </p>
      ) : null}
    </div>
  );
}

type WithRef<T, E> = T & { ref?: Ref<E> };

export function Input({ className, ...rest }: WithRef<InputHTMLAttributes<HTMLInputElement>, HTMLInputElement>) {
  return <input className={cn("control", className)} {...rest} />;
}

export function Textarea({
  className,
  rows = 3,
  ...rest
}: WithRef<TextareaHTMLAttributes<HTMLTextAreaElement>, HTMLTextAreaElement>) {
  return <textarea rows={rows} className={cn("control", className)} {...rest} />;
}

export function Select({
  className,
  children,
  ...rest
}: WithRef<SelectHTMLAttributes<HTMLSelectElement>, HTMLSelectElement>) {
  return (
    <select className={cn("control pr-8", className)} {...rest}>
      {children}
    </select>
  );
}

interface ToggleProps {
  checked: boolean;
  onChange: (checked: boolean) => void;
  label: string;
  description?: string;
  disabled?: boolean;
  "data-cy"?: string;
}

/** An on/off switch with its label. */
export function Toggle({ checked, onChange, label, description, disabled, ...rest }: ToggleProps) {
  const id = useId();
  return (
    <div className="flex items-start justify-between gap-4 py-2">
      <div>
        <label htmlFor={id} className="text-sm font-medium text-fg">
          {label}
        </label>
        {description && <p className="text-xs text-fg-subtle">{description}</p>}
      </div>
      <button
        id={id}
        type="button"
        role="switch"
        aria-checked={checked}
        disabled={disabled}
        onClick={() => onChange(!checked)}
        data-cy={rest["data-cy"]}
        className={cn(
          "relative h-6 w-11 shrink-0 rounded-full transition-colors disabled:opacity-50",
          checked ? "bg-brand" : "bg-line-strong",
        )}
      >
        <span
          className={cn(
            "absolute top-0.5 left-0.5 size-5 rounded-full bg-white shadow transition-transform",
            checked && "translate-x-5",
          )}
        />
      </button>
    </div>
  );
}

/** Shows the server's message for a field that isn't in the form, or a general one. */
export function FormError({ message }: { message?: string | null }) {
  if (!message) return null;
  return (
    <p role="alert" className="rounded-lg bg-danger-bg px-3 py-2 text-sm text-danger-fg" data-cy="form-error">
      {message}
    </p>
  );
}
