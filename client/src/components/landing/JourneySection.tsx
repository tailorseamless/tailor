import {
  CalendarDays,
  ClipboardCheck,
  Gift,
  Package,
  PackageCheck,
  Ruler,
  Scissors,
  Shirt,
  Sparkles,
  Wand2,
  type LucideIcon,
} from "lucide-react";
import type { OrderStatus } from "../../types/order.types";
import { cn } from "../../utils/cn";
import { ORDER_FLOW, ORDER_STATUS } from "../../utils/statusLabels";
import { Accent, Reveal, SectionHeading } from "./Reveal";
import { useAutoCycle, useInView, useReducedMotion } from "./useLandingMotion";

const STAGE: Record<Exclude<OrderStatus, "cancelled">, { icon: LucideIcon; says: string }> = {
  confirmed: { icon: ClipboardCheck, says: "We've got your order and your measurements." },
  awaiting_materials: { icon: Package, says: "We're getting your fabric ready." },
  cutting: { icon: Scissors, says: "Your fabric is being cut to your measurements." },
  sewing: { icon: Shirt, says: "Your outfit is being sewn." },
  fitting: { icon: Ruler, says: "Time to try it on. Pick a fitting time that suits you." },
  alterations: { icon: Wand2, says: "We're adjusting it so it fits perfectly." },
  finishing: { icon: Sparkles, says: "Final touches: hems, buttons and pressing." },
  ready: { icon: PackageCheck, says: "Your outfit is ready for collection! 🎉" },
  delivered: { icon: Gift, says: "Collected. Thank you, and wear it well." },
};

const STEPS = ORDER_FLOW as Exclude<OrderStatus, "cancelled">[];

function nextVisit(status: OrderStatus): string {
  if (status === "fitting" || status === "alterations") return "Fitting · Sat 10:00";
  if (status === "ready") return "Collection · any day";
  if (status === "delivered") return "None. Enjoy it!";
  return "We'll let you know";
}

export function JourneySection() {
  const reduced = useReducedMotion();
  const [ref, inView] = useInView<HTMLDivElement>({ once: false, threshold: 0.35 });
  const { index, select } = useAutoCycle(STEPS.length, 2000, inView && !reduced);
  const status = STEPS[index];
  const { icon: Icon, says } = STAGE[status];
  const pct = Math.round((index / (STEPS.length - 1)) * 100);
  const paid = index >= 7;

  return (
    <section id="journey" aria-labelledby="journey-title" className="overflow-hidden py-24 sm:py-32">
      <div className="mx-auto max-w-6xl px-4 sm:px-6">
        <SectionHeading
          id="journey-title"
          eyebrow="Your customers"
          title={
            <>
              From fabric to fitting, <Accent>nobody has to ask.</Accent>
            </>
          }
          lead="When you move an order along, your customer's private page moves with it. They see where their outfit is, what's left to pay and when to come in, without calling you."
        />

        <div ref={ref} className="mt-14 grid items-start gap-10 lg:grid-cols-[1fr_1.1fr] lg:gap-16">
          {/* The stages. A swipeable row on phones, a sewn column on wider screens. */}
          <Reveal className="lg:relative">
            <span
              aria-hidden
              className="absolute top-5 bottom-5 left-[19px] hidden border-l-2 border-dashed border-line-strong lg:block"
            />
            <span
              aria-hidden
              className="absolute top-5 left-[19px] hidden border-l-2 border-dashed border-brand transition-[height] duration-700 lg:block"
              style={{ height: `calc((100% - 2.5rem) * ${pct / 100})` }}
            />
            <ol
              aria-label="Order stages"
              className="-mx-4 flex snap-x gap-2 overflow-x-auto px-4 pb-2 [scrollbar-width:none] lg:mx-0 lg:flex-col lg:gap-0 lg:overflow-visible lg:px-0 lg:pb-0"
            >
              {STEPS.map((s, i) => {
                const StepIcon = STAGE[s].icon;
                const on = i === index;
                const done = i < index;
                return (
                  <li key={s} className="snap-start lg:relative">
                    <button
                      type="button"
                      aria-current={on ? "step" : undefined}
                      onClick={() => select(i)}
                      className={cn(
                        "flex w-max items-center gap-3 rounded-full border py-1.5 pr-4 pl-1.5 text-sm whitespace-nowrap transition-all lg:w-full lg:border-transparent lg:py-2",
                        on
                          ? "border-brand bg-brand-soft lg:border-transparent"
                          : "border-line bg-surface lg:bg-transparent lg:hover:bg-subtle",
                      )}
                      data-cy={`journey-${s}`}
                    >
                      <span
                        className={cn(
                          "relative z-10 grid size-7 shrink-0 place-items-center rounded-full transition-colors duration-500 lg:size-[26px]",
                          on && "bg-brand text-on-brand shadow-[0_0_0_6px_var(--brand-soft)]",
                          done && "bg-brand-soft text-link",
                          !on && !done && "bg-subtle text-fg-subtle",
                        )}
                      >
                        <StepIcon className="size-3.5" aria-hidden />
                      </span>
                      <span className={cn(on ? "font-semibold text-fg" : done ? "text-fg-muted" : "text-fg-subtle")}>
                        {ORDER_STATUS[s].label}
                      </span>
                    </button>
                  </li>
                );
              })}
            </ol>
          </Reveal>

          {/* What the customer sees on their phone. */}
          <Reveal delay={120}>
            <figure className="relative">
              <div
                aria-hidden
                className="absolute -inset-6 -z-10 rounded-[3rem] bg-linear-to-br from-brand-soft via-transparent to-brand-soft blur-2xl"
              />
              <div className="overflow-hidden rounded-[2rem] border border-line bg-surface shadow-[0_40px_80px_-40px_rgb(42_34_38/0.45)]">
                <div className="flex items-center gap-1.5 border-b border-line bg-subtle px-4 py-3">
                  <span className="size-2.5 rounded-full bg-[#ef8a8a]" />
                  <span className="size-2.5 rounded-full bg-[#f0c766]" />
                  <span className="size-2.5 rounded-full bg-[#8fd8a8]" />
                  <span className="ml-3 truncate rounded-md bg-surface px-3 py-1 text-xs text-fg-subtle">
                    …/portal/k7Qx2m9a
                  </span>
                </div>
                <div className="p-6 sm:p-8">
                  <p className="font-display text-xl font-semibold text-fg">Ìfẹ́ Couture</p>
                  <p className="text-sm text-fg-subtle">Hello Adaeze, here's your order.</p>

                  <div className="mt-6 rounded-2xl border border-line p-5">
                    <div className="flex items-center justify-between gap-3">
                      <span className="text-sm font-medium text-fg">Bridal gown · #0142</span>
                      <span className="text-xs text-fg-subtle">Due 14 Dec</span>
                    </div>
                    <div key={status} className="lp-pop mt-5 flex items-center gap-4">
                      <span className="grid size-14 shrink-0 place-items-center rounded-2xl bg-brand text-on-brand shadow-[0_12px_30px_-12px_var(--brand)]">
                        <Icon className="size-6" aria-hidden />
                      </span>
                      <span>
                        <span className="block font-display text-2xl font-semibold text-fg">
                          {ORDER_STATUS[status].label}
                        </span>
                        <span className="text-sm text-fg-muted">{says}</span>
                      </span>
                    </div>
                    <div className="mt-6 h-2 overflow-hidden rounded-full bg-subtle">
                      <div
                        className="h-full rounded-full bg-linear-to-r from-brand to-(--focus) transition-[width] duration-700"
                        style={{ width: `${Math.max(pct, 4)}%` }}
                      />
                    </div>
                  </div>

                  <div className="mt-4 grid gap-3 sm:grid-cols-2">
                    <div className="rounded-xl bg-subtle px-4 py-3">
                      <p className="text-xs text-fg-subtle">Balance</p>
                      <p className={cn("font-semibold", paid ? "text-success-fg" : "text-warning-fg")}>
                        {paid ? "All paid. Thank you!" : "₦70,000 left to pay"}
                      </p>
                    </div>
                    <div className="rounded-xl bg-subtle px-4 py-3">
                      <p className="text-xs text-fg-subtle">Next visit</p>
                      <p className="inline-flex items-center gap-1.5 font-semibold text-fg">
                        <CalendarDays className="size-4 text-link" aria-hidden />
                        {nextVisit(status)}
                      </p>
                    </div>
                  </div>
                </div>
              </div>
              <figcaption className="mt-4 text-center text-sm text-fg-subtle">
                What Adaeze sees. No app, no account, no password.
              </figcaption>
            </figure>
          </Reveal>
        </div>
      </div>
    </section>
  );
}
