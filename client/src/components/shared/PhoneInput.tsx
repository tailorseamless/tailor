import { ChevronDown } from "lucide-react";
import { useEffect, useRef, useState, type ChangeEvent } from "react";
import {
  buildPhone,
  countries,
  findCountry,
  parsePhone,
  rememberCountry,
  rememberedCountry,
} from "../../utils/countries";
import { cn } from "../../utils/cn";

interface PhoneInputProps {
  /** The whole number in international form ("+2348031234567"), or "" when empty. */
  value: string;
  onChange: (value: string) => void;
  onBlur?: () => void;
  disabled?: boolean;
  /** Spread from <Field>: the label's id and the error wiring. */
  id?: string;
  "aria-invalid"?: boolean;
  "aria-describedby"?: string;
  "data-cy"?: string;
}

/**
 * A country-code picker beside the number. The picker is a real <select> laid invisibly over the
 * "NG +234" label, so phones open their own native list. The value is always one string, so it
 * drops in wherever a plain phone <Input> was. Pasting "+44 7700 900123" switches the country by itself.
 */
export function PhoneInput({ value, onChange, onBlur, disabled, ...rest }: PhoneInputProps) {
  const [iso, setIso] = useState(() => parsePhone(value).iso ?? rememberedCountry());
  const [national, setNational] = useState(() => parsePhone(value).national);
  // What we last sent up, so we can tell a change made by the form (a reset, another record) from our own.
  const sent = useRef(value);

  useEffect(() => {
    if (value === sent.current) return;
    sent.current = value;
    const next = parsePhone(value);
    if (next.iso) setIso(next.iso);
    setNational(next.national);
  }, [value]);

  const emit = (nextIso: string, nextNational: string) => {
    const next = buildPhone(findCountry(nextIso).dial, nextNational);
    sent.current = next;
    onChange(next);
  };

  const pickCountry = (e: ChangeEvent<HTMLSelectElement>) => {
    setIso(e.target.value);
    rememberCountry(e.target.value);
    emit(e.target.value, national);
  };

  const typeNumber = (e: ChangeEvent<HTMLInputElement>) => {
    const raw = e.target.value;
    if (raw.trim().startsWith("+")) {
      // A pasted international number: let it choose the country.
      const pasted = parsePhone(raw);
      const nextIso = pasted.iso ?? iso;
      setIso(nextIso);
      setNational(pasted.national);
      emit(nextIso, pasted.national);
      return;
    }
    const clean = raw.replace(/[^\d\s().-]/g, "");
    setNational(clean);
    emit(iso, clean);
  };

  const country = findCountry(iso);
  const cy = rest["data-cy"];
  return (
    <div
      className={cn(
        "flex w-full rounded-lg border bg-surface focus-within:outline-2 focus-within:outline-offset-2 focus-within:outline-focus",
        rest["aria-invalid"] ? "border-danger-solid" : "border-control",
        disabled && "cursor-not-allowed opacity-60",
      )}
    >
      <div className="relative flex shrink-0 items-center border-r border-line">
        <span aria-hidden className="flex items-center gap-1 pr-2 pl-3 text-base whitespace-nowrap text-fg sm:text-sm">
          <span className="font-medium">{country.iso}</span>
          <span className="text-fg-muted tabular-nums">+{country.dial}</span>
          <ChevronDown className="size-4 text-fg-subtle" />
        </span>
        <select
          aria-label="Country code"
          value={iso}
          onChange={pickCountry}
          disabled={disabled}
          className="absolute inset-0 size-full cursor-pointer rounded-l-lg bg-surface text-base text-fg opacity-0 disabled:cursor-not-allowed"
          data-cy={cy ? `${cy}-country` : undefined}
        >
          {countries().map((c) => (
            <option key={c.iso} value={c.iso}>
              {c.name} (+{c.dial})
            </option>
          ))}
        </select>
      </div>
      <input
        id={rest.id}
        type="tel"
        inputMode="tel"
        autoComplete="tel-national"
        placeholder="Phone number"
        value={national}
        onChange={typeNumber}
        onBlur={onBlur}
        disabled={disabled}
        aria-invalid={rest["aria-invalid"]}
        aria-describedby={rest["aria-describedby"]}
        className="min-w-0 flex-1 rounded-r-lg bg-transparent px-3 py-2 text-base text-fg outline-none placeholder:text-fg-subtle disabled:cursor-not-allowed sm:text-sm"
        data-cy={cy}
      />
    </div>
  );
}
