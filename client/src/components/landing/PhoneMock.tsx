import { CalendarDays, LayoutDashboard, MessageCircle, Scissors, Users, Wallet } from "lucide-react";
import { useRef, type CSSProperties, type PointerEvent } from "react";
import type { OrderStatus } from "../../types/order.types";
import { cn } from "../../utils/cn";
import { ORDER_FLOW, ORDER_STATUS } from "../../utils/statusLabels";
import { Badge } from "../shared/Display";
import { useAutoCycle } from "./useLandingMotion";

const DEMO: OrderStatus[] = ["cutting", "sewing", "fitting", "finishing", "ready"];

const SWATCHES: CSSProperties[] = [
  { background: "conic-gradient(from 45deg, #e2b36a 0 25%, #7a2f55 0 50%, #e2b36a 0 75%, #7a2f55 0) 0 0 / 14px 14px" },
  { background: "radial-gradient(circle, #fff 1.6px, transparent 2px) 0 0 / 8px 8px, #e8b4cd" },
  { background: "repeating-linear-gradient(45deg, #1f5f5b 0 5px, #f3e3eb 5px 9px)" },
];

/** The app on a phone, an order moving through the workshop by itself. Purely illustrative. */
export function PhoneMock({ reduced }: { reduced: boolean }) {
  const { index } = useAutoCycle(DEMO.length, 2600, !reduced);
  const status = reduced ? "fitting" : DEMO[index];
  const ready = status === "ready";
  const step = ORDER_FLOW.indexOf(status);
  const tilt = useRef<HTMLDivElement>(null);

  const onMove = (e: PointerEvent<HTMLDivElement>) => {
    if (reduced || e.pointerType !== "mouse" || !tilt.current) return;
    const box = e.currentTarget.getBoundingClientRect();
    const x = (e.clientX - box.left) / box.width - 0.5;
    const y = (e.clientY - box.top) / box.height - 0.5;
    tilt.current.style.setProperty("--ry", `${x * 16}deg`);
    tilt.current.style.setProperty("--rx", `${-y * 10}deg`);
  };
  const onLeave = () => {
    tilt.current?.style.setProperty("--ry", "0deg");
    tilt.current?.style.setProperty("--rx", "0deg");
  };

  return (
    <div
      className="relative mx-auto w-full max-w-[17.5rem] sm:max-w-[20rem]"
      onPointerMove={onMove}
      onPointerLeave={onLeave}
      role="img"
      aria-label="TailorFlow on a phone: a bridal gown order moving from cutting to ready for collection."
    >
      <div ref={tilt} className="lp-tilt relative">
        <div className="rounded-[2.8rem] bg-[#0e060a] p-[9px] shadow-[0_60px_120px_-30px_rgb(0_0_0/0.75),inset_0_0_0_1px_rgb(255_255_255/0.1)]">
          <div className="relative aspect-[9/18.6] overflow-hidden rounded-[2.25rem] bg-canvas text-fg">
            <div className="absolute top-2.5 left-1/2 h-[22px] w-[84px] -translate-x-1/2 rounded-full bg-black" />
            <div className="flex justify-between px-6 pt-3 text-[10px] font-semibold">
              <span>9:41</span>
              <span className="flex items-center gap-1">
                <span className="h-2 w-3 rounded-[2px] bg-fg/80" />
                <span className="h-2.5 w-5 rounded-[3px] border border-fg/60 p-px">
                  <span className="block h-full w-3/4 rounded-[1px] bg-fg/80" />
                </span>
              </span>
            </div>

            <div className="px-4 pt-6">
              <p className="text-[10px] text-fg-subtle">Good morning 👋</p>
              <p className="font-display text-lg leading-tight font-semibold">Ìfẹ́ Couture</p>

              <div className="mt-3 grid grid-cols-2 gap-2">
                <MiniStat label="Due this week" value="6" />
                <MiniStat label="Owed to you" value={ready ? "₦350k" : "₦420k"} />
              </div>

              <p className="mt-4 mb-1.5 text-[10px] font-semibold tracking-wider text-fg-subtle uppercase">
                In the workshop
              </p>
              <div className="rounded-2xl border border-line bg-surface p-3 shadow-[0_6px_20px_-12px_rgb(42_34_38/0.35)]">
                <div className="flex items-start gap-2">
                  <span className="grid size-8 shrink-0 place-items-center rounded-full bg-brand-soft text-[11px] font-semibold text-link">
                    AO
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[12px] leading-tight font-semibold">Adaeze Okafor</p>
                    <p className="truncate text-[10px] text-fg-subtle">Bridal gown · #0142</p>
                  </div>
                  <Badge key={status} tone={ORDER_STATUS[status].tone} className="lp-pop px-1.5 text-[9px]">
                    {ready ? "Ready" : ORDER_STATUS[status].label}
                  </Badge>
                </div>
                <div className="mt-3 flex gap-[3px]" aria-hidden>
                  {ORDER_FLOW.map((s, i) => (
                    <span
                      key={s}
                      className={cn(
                        "h-1.5 flex-1 rounded-full transition-colors duration-500",
                        i <= step ? (ready ? "bg-success-fg" : "bg-brand") : "bg-subtle",
                      )}
                    />
                  ))}
                </div>
                <div className="mt-3 flex items-center justify-between text-[10px] text-fg-muted">
                  <span className="inline-flex items-center gap-1">
                    <CalendarDays className="size-3" aria-hidden /> Due Sat, 14 Dec
                  </span>
                  <span className={cn("font-semibold", ready ? "text-success-fg" : "text-warning-fg")}>
                    {ready ? "Paid in full" : "₦70,000 left"}
                  </span>
                </div>
              </div>

              <div className="mt-2 space-y-1.5">
                <MiniOrder initials="TB" name="Tunde Bakare" item="Agbada, 3 pieces" status="sewing" />
                <MiniOrder initials="KA" name="Kemi Adeyemi" item="Aso-ebi × 6" status="awaiting_materials" />
              </div>
            </div>

            <nav
              aria-hidden
              className="absolute inset-x-0 bottom-0 grid grid-cols-4 border-t border-line bg-surface/95 px-2 pt-2 pb-4 text-[9px] text-fg-subtle"
            >
              {[
                { icon: LayoutDashboard, label: "Home", on: true },
                { icon: Scissors, label: "Orders" },
                { icon: Users, label: "Customers" },
                { icon: CalendarDays, label: "Diary" },
              ].map(({ icon: Icon, label, on }) => (
                <span key={label} className={cn("flex flex-col items-center gap-0.5", on && "text-link")}>
                  <Icon className="size-4" />
                  {label}
                </span>
              ))}
            </nav>
          </div>
        </div>
      </div>

      {/* Floating pieces around the phone. */}
      <div aria-hidden className="lp-sway absolute top-20 -left-24 hidden sm:block lg:-left-28">
        <div className="mx-auto h-4 w-px bg-(--lp-blush)/70" />
        <div className="w-36 -rotate-3 rounded-xl border border-white/15 bg-[#fff7fa] p-3 text-(--lp-ink) shadow-2xl">
          <span className="mx-auto mb-2 block size-2 rounded-full bg-(--lp-ink)/20" />
          <p className="font-display text-sm font-semibold">Adaeze O.</p>
          <dl className="mt-1 space-y-0.5 text-[11px]">
            {[
              ["Bust", "38 in"],
              ["Waist", "30 in"],
              ["Hip", "41 in"],
            ].map(([k, v]) => (
              <div key={k} className="flex justify-between border-b border-dashed border-[#d8cad1] pb-0.5">
                <dt className="text-[#6f6168]">{k}</dt>
                <dd className="font-semibold">{v}</dd>
              </div>
            ))}
          </dl>
        </div>
      </div>

      <div aria-hidden className="absolute -right-4 bottom-24 w-52 sm:-right-12 lg:-right-14">
        <div
          key={status}
          className="lp-pop flex items-start gap-2.5 rounded-2xl border border-white/10 bg-[#fffafc] p-3 text-(--lp-ink) shadow-2xl"
        >
          <span
            className={cn(
              "grid size-8 shrink-0 place-items-center rounded-full text-white",
              ready ? "bg-[#25a35a]" : "bg-(--lp-plum)",
            )}
          >
            {ready ? <MessageCircle className="size-4" /> : <Scissors className="size-4" />}
          </span>
          <span className="text-[11px] leading-snug">
            <span className="block font-semibold">{ready ? "WhatsApp message ready" : "Order moved"}</span>
            <span className="text-[#5c4f56]">
              {ready
                ? "“Good news! Your bridal gown is ready for collection.”"
                : `Bridal gown is now at ${ORDER_STATUS[status].label.toLowerCase()}.`}
            </span>
          </span>
        </div>
      </div>

      <div
        aria-hidden
        className="lp-float absolute -bottom-6 -left-3 sm:-left-10"
        style={{ "--lp-delay": "-2s" } as CSSProperties}
      >
        <div className="flex items-center gap-2 rounded-full border border-white/10 bg-[#fffafc] py-1.5 pr-4 pl-1.5 text-(--lp-ink) shadow-2xl">
          <span className="grid size-7 place-items-center rounded-full bg-[#e7f5ec] text-[#1f6b3a]">
            <Wallet className="size-3.5" />
          </span>
          <span className="text-[11px] font-semibold">
            {ready ? "+₦70,000 · balance cleared" : "+₦80,000 · bank transfer"}
          </span>
        </div>
      </div>

      <div aria-hidden className="absolute -top-6 right-2 flex -space-x-3 sm:-right-6">
        {SWATCHES.map((s, i) => (
          <span
            key={i}
            className="lp-float size-11 rounded-full shadow-xl ring-2 ring-(--lp-ink)"
            style={{ ...s, "--lp-delay": `${-i * 1.4}s` } as CSSProperties}
          />
        ))}
      </div>
    </div>
  );
}

function MiniStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-line bg-surface px-2.5 py-2">
      <p className="text-[9px] text-fg-subtle">{label}</p>
      <p className="text-sm font-semibold">{value}</p>
    </div>
  );
}

function MiniOrder({
  initials,
  name,
  item,
  status,
}: {
  initials: string;
  name: string;
  item: string;
  status: OrderStatus;
}) {
  return (
    <div className="flex items-center gap-2 rounded-xl border border-line bg-surface px-2.5 py-2">
      <span className="grid size-6 shrink-0 place-items-center rounded-full bg-subtle text-[9px] font-semibold text-fg-muted">
        {initials}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-[11px] font-medium">{name}</span>
        <span className="block truncate text-[9px] text-fg-subtle">{item}</span>
      </span>
      <Badge tone={ORDER_STATUS[status].tone} className="px-1.5 text-[9px]">
        {status === "awaiting_materials" ? "Materials" : ORDER_STATUS[status].label}
      </Badge>
    </div>
  );
}
