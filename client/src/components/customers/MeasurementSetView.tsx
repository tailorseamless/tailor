import type { ReactNode } from "react";
import type { MeasurementUnit } from "../../types/auth.types";
import type { MeasurementValue } from "../../types/customer.types";
import { cn } from "../../utils/cn";

interface Props {
  values: MeasurementValue[];
  unit: MeasurementUnit;
  notes?: string | null;
  /** The body figure (wrapped in `FigureColumn`); the list takes the full width without it. */
  figure?: ReactNode;
}

/**
 * One measuring session as a list of numbers, with the body figure beside it
 * when the space is wide enough and underneath when it is not.
 */
export function MeasurementSetView({ values, unit, notes, figure }: Props) {
  return (
    <div className="@container">
      <div className={cn(figure && "grid gap-5 @2xl:grid-cols-[minmax(0,1fr)_24rem] @2xl:items-start")}>
        <div>
          <dl className={cn("grid grid-cols-2 gap-x-4 gap-y-1 sm:grid-cols-3", figure && "@2xl:grid-cols-1")}>
            {values.map((v) => (
              <div key={v.name} className="flex justify-between gap-2 border-b border-dashed border-line py-1 text-sm">
                <dt className="text-fg-muted">{v.name}</dt>
                <dd className="font-medium text-fg tabular-nums">
                  {v.value} {unit}
                </dd>
              </div>
            ))}
          </dl>
          {notes && <p className="mt-2 text-sm text-fg-muted">{notes}</p>}
        </div>
        {figure}
      </div>
    </div>
  );
}

/** Sizes and positions the figure: centred when stacked, in its own column when beside the list. */
export function FigureColumn({ children, ...rest }: { children: ReactNode; "data-cy"?: string }) {
  return (
    <div className="mx-auto w-full max-w-[24rem] @2xl:mx-0" {...rest}>
      {children}
    </div>
  );
}
