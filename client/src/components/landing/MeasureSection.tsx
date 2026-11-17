import { useState } from "react";
import { cn } from "../../utils/cn";
import { DressForm, type PointId } from "./DressForm";
import { Accent, Reveal, SectionHeading } from "./Reveal";
import { useAutoCycle, useInView, useReducedMotion } from "./useLandingMotion";

const POINTS: { id: PointId; label: string; inches: number }[] = [
  { id: "bust", label: "Bust", inches: 38 },
  { id: "waist", label: "Waist", inches: 30 },
  { id: "hip", label: "Hip", inches: 41 },
  { id: "shoulder", label: "Shoulder", inches: 16 },
  { id: "neck", label: "Neck", inches: 14 },
  { id: "length", label: "Length", inches: 24 },
];

type Unit = "in" | "cm";
const show = (inches: number, unit: Unit) =>
  unit === "in" ? `${inches} in` : `${(Math.round(inches * 2.54 * 2) / 2).toString()} cm`;

export function MeasureSection() {
  const reduced = useReducedMotion();
  const [ref, inView] = useInView<HTMLDivElement>({ once: false, threshold: 0.3 });
  const { index, select } = useAutoCycle(POINTS.length, 2200, inView && !reduced);
  const [unit, setUnit] = useState<Unit>("in");
  const point = POINTS[index];

  return (
    <section id="measurements" aria-labelledby="measure-title" className="relative overflow-hidden py-24 sm:py-32">
      <div className="mx-auto grid max-w-6xl items-center gap-14 px-4 sm:px-6 lg:grid-cols-2 lg:gap-20">
        <div>
          <SectionHeading
            id="measure-title"
            eyebrow="Measurements"
            title={
              <>
                Every body, <Accent>remembered.</Accent>
              </>
            }
            lead="Take measurements once, in your own template: bust, waist, agbada length, whatever you use. They follow your customer to every order, on every phone in the shop. No more tape-and-notebook guesswork."
          />

          <Reveal delay={150} className="mt-10">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <p className="text-sm font-medium text-fg-muted" id="measure-pick">
                Tap a measurement
              </p>
              <div
                role="group"
                aria-label="Units"
                className="inline-flex rounded-full border border-line bg-surface p-1"
              >
                {(["in", "cm"] as Unit[]).map((u) => (
                  <button
                    key={u}
                    type="button"
                    aria-pressed={unit === u}
                    onClick={() => setUnit(u)}
                    className={cn(
                      "h-8 rounded-full px-4 text-sm font-medium transition-colors",
                      unit === u ? "bg-fg text-canvas" : "text-fg-muted hover:text-fg",
                    )}
                    data-cy={`measure-unit-${u}`}
                  >
                    {u}
                  </button>
                ))}
              </div>
            </div>

            <div role="group" aria-labelledby="measure-pick" className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-3">
              {POINTS.map((p, i) => {
                const on = i === index;
                return (
                  <button
                    key={p.id}
                    type="button"
                    aria-pressed={on}
                    onClick={() => select(i)}
                    className={cn(
                      "group flex items-baseline justify-between rounded-xl border px-4 py-3 text-left transition-all",
                      on
                        ? "border-brand bg-brand-soft shadow-[0_8px_24px_-14px_var(--brand)]"
                        : "border-line bg-surface hover:-translate-y-0.5 hover:border-line-strong",
                    )}
                    data-cy={`measure-${p.id}`}
                  >
                    <span className={cn("text-sm", on ? "font-semibold text-link" : "text-fg-muted")}>{p.label}</span>
                    <span className="font-display text-lg font-semibold text-fg tabular-nums">
                      {show(p.inches, unit)}
                    </span>
                  </button>
                );
              })}
            </div>
            <p className="mt-4 text-sm text-fg-subtle">
              {point.label}: <strong className="text-fg">{show(point.inches, unit)}</strong>, saved for Adaeze and used
              on every order she places.
            </p>
          </Reveal>
        </div>

        <Reveal delay={100}>
          <div ref={ref} className="relative">
            <div className="lp-mat relative overflow-hidden rounded-[2rem] border border-line p-6 shadow-[0_40px_80px_-40px_rgb(42_34_38/0.45)] sm:p-10">
              <div aria-hidden className="lp-ruler absolute inset-x-0 top-0 h-3 border-b border-line bg-surface/80" />
              <div aria-hidden className="absolute top-6 left-6 font-display text-sm text-fg-subtle italic">
                Fitting room
              </div>
              <div className="flex justify-center pt-4">
                <DressForm active={point.id} value={show(point.inches, unit)} />
              </div>
            </div>
            <div
              aria-hidden
              className="absolute -right-3 -bottom-5 rotate-3 rounded-xl bg-(--lp-ink) px-4 py-3 text-(--lp-cream) shadow-2xl sm:-right-6"
            >
              <p className="text-[11px] tracking-widest text-(--lp-blush) uppercase">Your template</p>
              <p className="font-display text-lg">Women · Gown</p>
            </div>
          </div>
        </Reveal>
      </div>
    </section>
  );
}
