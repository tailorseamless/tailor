import { X } from "lucide-react";
import { useState, type ReactNode } from "react";
import type { MeasurementUnit } from "../../types/auth.types";
import { answerText, calculate, FRACTION_KEYS, pressKey } from "../../utils/calculate";
import { cn } from "../../utils/cn";
import { Button, IconButton } from "../shared/Button";
import { Input } from "../shared/Field";

const SPOKEN: Record<string, string> = {
  "÷": "divide",
  "×": "times",
  "−": "minus",
  "+": "plus",
  "=": "equals",
  "⌫": "delete the last character",
  C: "clear",
  "⅛": "one eighth",
  "¼": "one quarter",
  "⅜": "three eighths",
  "½": "one half",
  "⅝": "five eighths",
  "¾": "three quarters",
  "⅞": "seven eighths",
};

const KEYPAD = ["7", "8", "9", "÷", "4", "5", "6", "×", "1", "2", "3", "−", "0", ".", "=", "+"];
const MAX_MEASURE = 1000;

interface Props {
  unit: MeasurementUnit;
  /** What the "Use" button fills: the measurement box tapped last (its name), or null when none was. */
  target: string | null;
  onUse: (value: string) => void;
  onClose: () => void;
}

/**
 * A calculator for the measuring session: halve a round measurement, add an allowance, add up pieces, with a row of
 * tape fractions because a phone's number pad has no ½ or +. "Use" puts the answer in the box tapped last.
 */
export function MeasureCalculator({ unit, target, onUse, onClose }: Props) {
  const [expression, setExpression] = useState("");
  const answer = calculate(expression);
  const usable = answer !== null && answer > 0 && answer <= MAX_MEASURE;
  const press = (key: string) => setExpression((now) => pressKey(now, key));

  const use = () => {
    if (!usable || target === null) return;
    onUse(answerText(answer));
    setExpression("");
  };

  // Tapping a key must not pull focus off the measurement box being filled in.
  const keep = { onMouseDown: (e: React.MouseEvent) => e.preventDefault() };
  const key = (label: string, className?: string): ReactNode => (
    <button
      key={label}
      type="button"
      aria-label={SPOKEN[label] ?? label}
      onClick={() => press(label)}
      {...keep}
      className={cn(
        "h-9 rounded-lg border border-line bg-surface text-base font-medium text-fg tabular-nums hover:bg-canvas active:bg-brand-soft",
        className,
      )}
      data-cy={`calc-key-${label}`}
    >
      {label}
    </button>
  );

  return (
    <div role="group" aria-label="Calculator" className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_15rem]" data-cy="measure-calc">
      <div className="space-y-2">
        {/* On a phone every line counts, so the title goes and the close button moves up beside the keys. */}
        <div className="hidden items-center justify-between sm:flex">
          <span className="text-sm font-medium text-fg">Calculator</span>
          <IconButton label="Close calculator" className="size-7" onClick={onClose} data-cy="calc-close">
            <X className="size-4" aria-hidden />
          </IconButton>
        </div>
        <div className="flex items-center gap-2">
          <Input
            aria-label="Calculation"
            // The keypad is the keyboard on a phone; a physical keyboard still types here.
            inputMode="none"
            autoComplete="off"
            spellCheck={false}
            placeholder="0"
            value={expression}
            onChange={(e) => setExpression(e.target.value.slice(0, 60))}
            onKeyDown={(e) => {
              if (e.key !== "Enter") return;
              e.preventDefault();
              press("=");
            }}
            className="min-w-0 flex-1 text-right text-lg tabular-nums"
            data-cy="calc-display"
          />
          <button
            type="button"
            aria-label={SPOKEN["⌫"]}
            onClick={() => press("⌫")}
            {...keep}
            className="h-11 w-11 shrink-0 rounded-lg border border-line bg-surface text-base text-fg-muted hover:bg-canvas"
            data-cy="calc-key-⌫"
          >
            ⌫
          </button>
          <button
            type="button"
            aria-label={SPOKEN.C}
            onClick={() => press("C")}
            {...keep}
            className="h-11 w-11 shrink-0 rounded-lg border border-line bg-surface text-base font-medium text-fg-muted hover:bg-canvas"
            data-cy="calc-key-C"
          >
            C
          </button>
          <IconButton label="Close calculator" className="size-8 shrink-0 sm:hidden" onClick={onClose} data-cy="calc-close-phone">
            <X className="size-4" aria-hidden />
          </IconButton>
        </div>
        <div className="flex items-center gap-2">
          <p className="min-w-0 flex-1 text-sm text-fg-muted tabular-nums" aria-live="polite" data-cy="calc-answer">
            {answer !== null
              ? `= ${answerText(answer)} ${unit === "cm" ? "cm" : "in"}${usable ? "" : ": has to be above 0"}`
              : expression
                ? "Not a sum yet"
                : "Try 20 × 2 or 17 + ½"}
          </p>
          <Button
            size="sm"
            className="shrink-0"
            disabled={!usable || target === null}
            onClick={use}
            {...keep}
            data-cy="calc-use"
          >
            {usable && target !== null ? `Use for ${target || "this box"}` : "Use"}
          </Button>
        </div>
        {target === null && <p className="text-xs text-fg-subtle">Tap a measurement box first, then press Use.</p>}
      </div>

      <div className="space-y-2">
        <div className="grid grid-cols-7 gap-1">
          {FRACTION_KEYS.map((fraction) => key(fraction, "h-8 text-sm"))}
        </div>
        <div className="grid grid-cols-4 gap-1">
          {KEYPAD.map((label) => key(label, "+−×÷=".includes(label) ? "bg-subtle" : undefined))}
        </div>
      </div>
    </div>
  );
}
