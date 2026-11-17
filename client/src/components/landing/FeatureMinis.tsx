import { Copy, Link2, TriangleAlert } from "lucide-react";
import { cn } from "../../utils/cn";

/* Small, purely decorative illustrations of each part of the app. Each is aria-hidden by its card. */

const COLUMNS = [
  { title: "Cutting", cards: ["Senator · Emeka", "Kaftan · Bola"] },
  { title: "Sewing", cards: ["Agbada · Tunde", "Gown · Adaeze", "Suit · Musa"] },
  { title: "Fitting", cards: ["Iro & bùbá · Ngozi"] },
  { title: "Ready", cards: ["Uniforms × 40"] },
];

export function OrdersMini() {
  return (
    <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
      {COLUMNS.map((col, c) => (
        <div key={col.title} className="rounded-xl bg-subtle p-2">
          <p className="mb-1.5 flex items-center justify-between px-1 text-[11px] font-semibold text-fg-muted">
            {col.title} <span className="text-fg-subtle">{col.cards.length}</span>
          </p>
          <div className="space-y-1.5">
            {col.cards.map((card, i) => (
              <div
                key={card}
                className={cn(
                  "rounded-lg border border-line bg-surface px-2 py-1.5 text-[11px] text-fg shadow-sm",
                  c === 1 && i === 1 && "lp-float border-brand/50",
                )}
              >
                {card}
                <span
                  className={cn("mt-1 block h-1 rounded-full", c === 3 ? "bg-success-fg/60" : "bg-brand/40")}
                  style={{ width: `${40 + ((c * 2 + i) % 4) * 15}%` }}
                />
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

export function PaymentsMini() {
  return (
    <div className="space-y-2 text-[12px]">
      {[
        ["Deposit", "Cash", "₦100,000"],
        ["Part payment", "Transfer", "₦80,000"],
      ].map(([what, how, amount]) => (
        <div
          key={what}
          className="flex items-center justify-between rounded-lg border border-line bg-surface px-3 py-2"
        >
          <span>
            <span className="block font-medium text-fg">{what}</span>
            <span className="text-[11px] text-fg-subtle">{how}</span>
          </span>
          <span className="font-semibold text-success-fg tabular-nums">{amount}</span>
        </div>
      ))}
      <div className="rounded-lg bg-subtle p-3">
        <div className="flex justify-between text-[11px] text-fg-muted">
          <span>₦180,000 of ₦250,000</span>
          <span className="font-semibold text-warning-fg">₦70,000 left</span>
        </div>
        <div className="mt-2 h-2 overflow-hidden rounded-full bg-line">
          <div className="h-full w-[72%] rounded-full bg-linear-to-r from-brand to-(--focus)" />
        </div>
      </div>
    </div>
  );
}

const DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const SLOTS: [number, number, number, string][] = [
  // day, start row, rows, colour
  [0, 0, 2, "bg-info-bg text-info-fg"],
  [1, 1, 1, "bg-brand-soft text-link"],
  [2, 0, 1, "bg-success-bg text-success-fg"],
  [3, 2, 2, "bg-brand-soft text-link"],
  [5, 0, 1, "bg-danger-bg text-danger-fg"],
  [5, 1, 2, "bg-info-bg text-info-fg"],
];

export function DiaryMini() {
  return (
    <div>
      <div className="grid grid-cols-6 gap-1 text-center text-[10px] font-medium text-fg-subtle">
        {DAYS.map((d) => (
          <span key={d}>{d}</span>
        ))}
      </div>
      <div className="relative mt-1 grid h-28 grid-cols-6 grid-rows-4 gap-1">
        {DAYS.map((d) => (
          <span
            key={d}
            className="row-span-4 rounded-md bg-subtle"
            style={{ gridColumn: DAYS.indexOf(d) + 1, gridRow: "1 / 5" }}
          />
        ))}
        {SLOTS.map(([day, start, rows, tone], i) => (
          <span
            key={i}
            className={cn("z-10 rounded-md border border-current/20", tone)}
            style={{ gridColumn: day + 1, gridRow: `${start + 1} / span ${rows}` }}
          />
        ))}
      </div>
      <p className="mt-3 inline-flex items-center gap-1.5 rounded-full bg-warning-bg px-2.5 py-1 text-[11px] font-medium text-warning-fg">
        <TriangleAlert className="size-3.5" /> Two fittings at 10:00 on Saturday
      </p>
    </div>
  );
}

export function PortalMini() {
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      <div className="rounded-xl border border-line bg-surface p-3">
        <p className="text-[11px] font-medium text-fg-subtle">Private link for Adaeze</p>
        <div className="mt-2 flex items-center gap-2 rounded-lg bg-subtle px-2.5 py-2 text-[11px] text-fg-muted">
          <Link2 className="size-3.5 shrink-0 text-link" />
          <span className="truncate">…/portal/k7Qx2m9a</span>
          <Copy className="ml-auto size-3.5 shrink-0" />
        </div>
        <p className="mt-3 text-[11px] font-medium text-fg-subtle">Booking page for new customers</p>
        <div className="mt-2 flex items-center gap-2 rounded-lg bg-subtle px-2.5 py-2 text-[11px] text-fg-muted">
          <Link2 className="size-3.5 shrink-0 text-link" />
          <span className="truncate">…/book/ife-couture</span>
        </div>
      </div>
      <div className="rounded-xl bg-[#e9f7ee] p-3 text-[12px] text-[#16351f] dark:bg-[#173322] dark:text-[#d6f2df]">
        <p className="text-[10px] font-semibold tracking-wider uppercase opacity-70">WhatsApp, written for you</p>
        <p className="mt-2 rounded-lg rounded-tl-none bg-white/80 p-2.5 leading-snug shadow-sm dark:bg-white/10">
          Hello Adaeze, your bridal gown (order 0142) is ready for a fitting at Ìfẹ́ Couture. When can you come in?
        </p>
        <p className="mt-1 text-right text-[10px] opacity-70">One tap to send ✓✓</p>
      </div>
    </div>
  );
}

export function MaterialsMini() {
  return (
    <ul className="space-y-2.5 text-[12px]">
      {[
        { name: "French lace", left: "12 yds", pct: 70, low: false },
        { name: "Ankara, blue print", left: "3 yds", pct: 14, low: true },
        { name: "Satin lining", left: "20 yds", pct: 88, low: false },
      ].map((m) => (
        <li key={m.name}>
          <div className="flex justify-between">
            <span className="text-fg">{m.name}</span>
            <span className={cn("font-medium", m.low ? "text-danger-fg" : "text-fg-muted")}>
              {m.low ? `Low · ${m.left}` : m.left}
            </span>
          </div>
          <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-subtle">
            <div
              className={cn("h-full rounded-full", m.low ? "bg-danger-solid" : "bg-brand")}
              style={{ width: `${m.pct}%` }}
            />
          </div>
        </li>
      ))}
    </ul>
  );
}

export function TeamMini() {
  return (
    <div>
      <div className="flex -space-x-2">
        {[
          ["FA", "bg-brand text-on-brand"],
          ["CO", "bg-info-bg text-info-fg"],
          ["MS", "bg-success-bg text-success-fg"],
          ["JE", "bg-warning-bg text-warning-fg"],
        ].map(([who, tone]) => (
          <span
            key={who}
            className={cn(
              "grid size-9 place-items-center rounded-full text-[11px] font-semibold ring-2 ring-surface",
              tone,
            )}
          >
            {who}
          </span>
        ))}
        <span className="grid size-9 place-items-center rounded-full bg-subtle text-[11px] font-semibold text-fg-muted ring-2 ring-surface">
          +3
        </span>
      </div>
      <div className="mt-4 flex flex-wrap gap-1.5 text-[11px]">
        {["Owner", "Manager", "Tailor", "Front desk"].map((r) => (
          <span key={r} className="rounded-full border border-line px-2.5 py-1 text-fg-muted">
            {r}
          </span>
        ))}
      </div>
      <p className="mt-3 text-[11px] text-fg-subtle">2 branches · Lekki and Ikeja</p>
    </div>
  );
}

export function ReportsMini() {
  return (
    <div>
      <div className="flex items-baseline gap-2">
        <span className="font-display text-2xl font-semibold text-fg">₦2.4m</span>
        <span className="rounded-full bg-success-bg px-2 py-0.5 text-[11px] font-medium text-success-fg">+18%</span>
      </div>
      <p className="text-[11px] text-fg-subtle">Collected this month</p>
      <svg viewBox="0 0 200 60" className="mt-3 h-16 w-full" preserveAspectRatio="none">
        <defs>
          <linearGradient id="lp-area" x1="0" x2="0" y1="0" y2="1">
            <stop offset="0" stopColor="var(--brand)" stopOpacity=".35" />
            <stop offset="1" stopColor="var(--brand)" stopOpacity="0" />
          </linearGradient>
        </defs>
        <path d="M0 48 C20 44 30 50 50 38 S80 30 100 34 S140 14 160 18 S190 8 200 6 V60 H0 Z" fill="url(#lp-area)" />
        <path
          d="M0 48 C20 44 30 50 50 38 S80 30 100 34 S140 14 160 18 S190 8 200 6"
          fill="none"
          stroke="var(--brand)"
          strokeWidth="2"
          vectorEffect="non-scaling-stroke"
        />
      </svg>
    </div>
  );
}
