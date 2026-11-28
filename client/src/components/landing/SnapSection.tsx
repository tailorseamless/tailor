import { ArrowRight, Camera, Check, CheckCircle2, ListChecks, ScanText, type LucideIcon } from "lucide-react";
import { useState, type CSSProperties } from "react";
import { Link } from "react-router-dom";
import { cn } from "../../utils/cn";
import { SIGN_UP } from "./LandingHeader";
import { Reveal, SectionHeading } from "./Reveal";
import { useAutoCycle, useInView, useReducedMotion } from "./useLandingMotion";

const STEPS: { id: string; icon: LucideIcon; title: string; body: string }[] = [
  {
    id: "snap",
    icon: Camera,
    title: "Snap or upload",
    body: "Photograph a page of your notebook or an order card, or upload a spreadsheet, Word or PDF file.",
  },
  {
    id: "read",
    icon: ScanText,
    title: "It reads it",
    body: "Names, numbers, measurements and orders are picked out and put where they belong.",
  },
  {
    id: "check",
    icon: ListChecks,
    title: "You check",
    body: "Fix anything it misread against your page. Nothing is saved until you say so.",
  },
  {
    id: "save",
    icon: CheckCircle2,
    title: "Saved",
    body: "One tap saves them all, and it asks before adding new measurements to your templates.",
  },
];

/** The example page, written the way tailors write: short names and no units. */
const PAGE = ["Adaeze Okafor", "0803 000 1234", "Bust   38", "Wst   30", "Hip   41", "Sh   16", "Slit   12"];

const MEASUREMENTS = [
  ["Bust", "38 in"],
  ["Waist", "30 in"],
  ["Hip", "41 in"],
  ["Shoulder", "16 in"],
  ["Slit", "12 in"],
];

const delay = (ms: number) => ({ animationDelay: `${ms}ms` }) as CSSProperties;

/** The headline feature: a paper record becomes a filled-in customer. Illustrative only. */
export function SnapSection() {
  const reduced = useReducedMotion();
  const [ref, inView] = useInView<HTMLDivElement>({ once: false, threshold: 0.3 });
  const { index, select } = useAutoCycle(STEPS.length, 2600, inView && !reduced);
  const [picked, setPicked] = useState(false);
  // With less motion nothing cycles, so show the filled-in result rather than a blank card.
  const stage = reduced && !picked ? 2 : index;
  const step = STEPS[stage];

  return (
    <section
      id="snap"
      aria-labelledby="snap-title"
      className="lp-atelier relative isolate overflow-hidden py-24 sm:py-32"
    >
      <div aria-hidden className="lp-weave absolute inset-0 -z-10" />
      <div aria-hidden className="lp-glow top-[-20%] right-[-10%] size-[30rem] bg-[#9b3b6c]" />

      <div className="mx-auto max-w-6xl px-4 sm:px-6">
        <SectionHeading
          id="snap-title"
          eyebrow="New · Snap or upload"
          align="center"
          tone="dark"
          title={
            <>
              Snap your notebook. <em className="lp-shimmer pr-1 font-normal italic">Skip the typing.</em>
            </>
          }
          lead="Years of customers on paper? Take a photo of the page, or upload your file. Tailor Seamless fills in your customers, their measurements and their orders for you to check."
        />

        <Reveal delay={100} className="mt-12">
          <ol className="grid grid-cols-2 gap-2 sm:grid-cols-4 sm:gap-3">
            {STEPS.map((s, i) => {
              const on = i === stage;
              return (
                <li key={s.id}>
                  <button
                    type="button"
                    aria-current={on ? "step" : undefined}
                    onClick={() => {
                      select(i);
                      setPicked(true);
                    }}
                    className={cn(
                      "flex h-full w-full flex-col items-start gap-2 rounded-2xl border p-4 text-left transition-colors",
                      on ? "border-(--lp-blush) bg-white/10" : "border-white/15 bg-white/5 hover:border-white/35",
                    )}
                    data-cy={`snap-step-${s.id}`}
                  >
                    <span className="flex items-center gap-2.5">
                      <span
                        className={cn(
                          "grid size-9 shrink-0 place-items-center rounded-xl transition-colors",
                          on ? "bg-(--lp-brass) text-(--lp-ink)" : "bg-white/10 text-(--lp-blush)",
                        )}
                      >
                        <s.icon className="size-4" aria-hidden />
                      </span>
                      <span className="font-display text-base font-semibold text-(--lp-cream)">{s.title}</span>
                    </span>
                    <span className="hidden text-sm leading-relaxed text-[#e9d3de] sm:block">{s.body}</span>
                  </button>
                </li>
              );
            })}
          </ol>
          {/* Phones show one explanation at a time, under the buttons. */}
          <p className="mt-3 min-h-[3.75rem] text-center text-sm text-[#e9d3de] sm:hidden">{step.body}</p>
        </Reveal>

        <Reveal delay={150} className="mt-10">
          <div
            ref={ref}
            role="img"
            aria-label="A handwritten measurement page for Adaeze Okafor is read into a customer record with her measurements and a gown order, ready to check and save."
            className="grid grid-cols-1 items-stretch gap-6 lg:grid-cols-[1fr_auto_1fr] lg:gap-8"
          >
            {/* The paper. */}
            <div className="relative mx-auto w-full max-w-md">
              <div className="lp-paper relative h-full -rotate-2 overflow-hidden rounded-2xl px-8 pt-8 pb-8 text-[#2b3a67] shadow-[0_40px_80px_-30px_rgb(0_0_0/0.7)]">
                <span aria-hidden className="absolute inset-y-0 left-6 w-px bg-[#e59aa6]" />
                <div className="pl-3 font-display text-xl leading-8 italic">
                  {PAGE.map((line) => (
                    <p key={line} className="whitespace-pre">
                      {line}
                    </p>
                  ))}
                  <p>Bridal gown ₦150,000</p>
                  <p>due 14 Dec</p>
                </div>
                {stage === 1 && (
                  <span className="lp-scan absolute inset-x-0 h-1 bg-(--lp-plum) shadow-[0_0_24px_8px_rgb(155_59_108/0.45)]" />
                )}
              </div>
              {stage === 0 && (
                <div className="lp-pop pointer-events-none absolute -inset-3">
                  {[
                    "top-0 left-0 border-t-4 border-l-4",
                    "top-0 right-0 border-t-4 border-r-4",
                    "bottom-0 left-0 border-b-4 border-l-4",
                    "right-0 bottom-0 border-r-4 border-b-4",
                  ].map((corner) => (
                    <span key={corner} className={cn("absolute size-10 rounded-sm border-(--lp-brass)", corner)} />
                  ))}
                  <span className="absolute -bottom-3 left-1/2 grid size-14 -translate-x-1/2 place-items-center rounded-full border-4 border-(--lp-cream) bg-(--lp-brass) text-(--lp-ink) shadow-2xl">
                    <Camera className="size-6" />
                  </span>
                </div>
              )}
            </div>

            <div className="grid place-items-center">
              <span className="grid size-12 place-items-center rounded-full bg-white/10 text-(--lp-brass)">
                <ArrowRight className="size-6 rotate-90 lg:rotate-0" />
              </span>
            </div>

            {/* What the app makes of it. */}
            {/* Every step keeps the same height (hidden, not removed), so the page below never jumps. */}
            <div className="relative mx-auto flex w-full max-w-md flex-col rounded-3xl bg-surface p-5 text-fg shadow-[0_40px_80px_-30px_rgb(0_0_0/0.7)] sm:p-6">
              {/* Keyed so the pieces pop in again each time the page is "read". */}
              <div
                key={stage === 0 ? "waiting" : "filled"}
                className={cn("flex flex-1 flex-col", stage === 0 && "invisible")}
              >
                <div className="lp-pop flex items-center gap-3">
                  <span className="grid size-10 shrink-0 place-items-center rounded-full bg-brand-soft text-sm font-semibold text-link">
                    AO
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-display text-lg font-semibold">Adaeze Okafor</span>
                    <span className="block text-sm text-fg-subtle">08030001234</span>
                  </span>
                  <span
                    className={cn(
                      "rounded-full px-2.5 py-1 text-xs font-medium whitespace-nowrap",
                      stage === 3 ? "bg-success-bg text-success-fg" : "bg-warning-bg text-warning-fg",
                    )}
                  >
                    {stage === 3 ? "Saved" : stage === 2 ? "Check it" : "Reading…"}
                  </span>
                </div>

                <dl className="mt-4 grid grid-cols-2 gap-2">
                  {MEASUREMENTS.map(([name, value], i) => (
                    <div
                      key={name}
                      className="lp-pop flex items-baseline justify-between rounded-xl bg-subtle px-3 py-2"
                      style={delay(i * 120)}
                    >
                      <dt className="text-sm text-fg-muted">{name}</dt>
                      <dd className="font-semibold tabular-nums">{value}</dd>
                    </div>
                  ))}
                </dl>

                <div
                  className="lp-pop mt-3 flex items-center justify-between gap-3 rounded-xl border border-line px-3 py-2.5 text-sm"
                  style={delay(700)}
                >
                  <span className="font-medium">Bridal gown · ₦150,000</span>
                  <span className="text-fg-subtle">Due 14 Dec</span>
                </div>

                {/* Both endings share one cell, so the taller one sets the height. */}
                <div className="mt-auto grid pt-4 *:col-start-1 *:row-start-1">
                  <div
                    className={cn(
                      "rounded-xl bg-success-bg px-3 py-2.5 text-sm text-success-fg",
                      stage === 3 ? "lp-pop" : "invisible",
                    )}
                  >
                    <p className="flex items-center gap-2 font-medium">
                      <Check className="size-4" /> Saved to your customers
                    </p>
                    <p className="mt-0.5 pl-6">“Slit” added to your Gown template</p>
                  </div>
                  <span
                    className={cn(
                      "flex h-11 items-center justify-center self-center rounded-xl bg-brand text-sm font-semibold text-on-brand",
                      stage === 3 && "invisible",
                    )}
                  >
                    Save all
                  </span>
                </div>
              </div>

              {stage === 0 && (
                <div className="absolute inset-0 grid place-items-center text-center">
                  <div>
                    <ScanText className="mx-auto size-8 text-fg-subtle" />
                    <p className="mt-3 text-sm text-fg-muted">Waiting for your page…</p>
                  </div>
                </div>
              )}
            </div>
          </div>
        </Reveal>

        <Reveal className="mt-12 flex flex-col items-center gap-4 text-center">
          <Link
            to={SIGN_UP}
            className="group inline-flex h-13 items-center justify-center gap-2 rounded-full bg-(--lp-cream) px-8 text-base font-semibold text-(--lp-plum) shadow-[0_10px_40px_-10px_rgb(232_180_205/0.6)] transition-transform hover:-translate-y-0.5"
            data-cy="snap-create-account"
          >
            Move your records in
            <ArrowRight className="size-5 transition-transform group-hover:translate-x-1" aria-hidden />
          </Link>
          <p className="text-sm text-[#e9d3de]">Photos, PDF, Excel, Word, CSV and text files.</p>
        </Reveal>
      </div>
    </section>
  );
}
