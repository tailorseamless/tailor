import { cn } from "../../utils/cn";

export type PointId = "neck" | "shoulder" | "bust" | "waist" | "hip" | "length";

/** Where each tape sits on the form. Rings are drawn in two halves so the back half hides behind the body. */
const RINGS: Partial<Record<PointId, { cx: number; cy: number; rx: number; ry: number }>> = {
  neck: { cx: 160, cy: 58, rx: 17, ry: 5 },
  bust: { cx: 160, cy: 176, rx: 74, ry: 13 },
  waist: { cx: 160, cy: 246, rx: 50, ry: 10 },
  hip: { cx: 160, cy: 311, rx: 72, ry: 13 },
};

const BODY =
  "M145 66 C130 76 98 80 86 94 C78 104 80 118 86 132 C92 148 86 166 90 184 C94 206 108 228 112 246 C114 268 94 290 92 312 L96 336 Q160 352 224 336 L228 312 C226 290 206 268 208 246 C212 228 226 206 230 184 C234 166 228 148 234 132 C240 118 242 104 234 94 C222 80 190 76 175 66 Z";

const arc = (r: { cx: number; cy: number; rx: number; ry: number }, front: boolean) =>
  `M${r.cx - r.rx} ${r.cy} A${r.rx} ${r.ry} 0 0 ${front ? 0 : 1} ${r.cx + r.rx} ${r.cy}`;

/** The pill showing the active value, beside its tape. */
const LABEL_AT: Record<PointId, { x: number; y: number }> = {
  neck: { x: 182, y: 46 },
  shoulder: { x: 246, y: 96 },
  bust: { x: 240, y: 176 },
  waist: { x: 216, y: 246 },
  hip: { x: 238, y: 311 },
  length: { x: 264, y: 214 },
};

/** A tailor's dress form with tape lines; the active one glows brass and marches. Decorative: the buttons beside it carry the meaning. */
export function DressForm({ active, value }: { active: PointId; value: string }) {
  const tape = (id: PointId) =>
    cn(
      "transition-[stroke,stroke-width,opacity] duration-500",
      id === active ? "lp-march stroke-(--lp-brass) opacity-100" : "stroke-fg-subtle opacity-40",
    );
  const width = (id: PointId) => (id === active ? 3 : 1.5);
  const label = LABEL_AT[active];

  return (
    <svg viewBox="0 0 340 480" aria-hidden className="h-auto w-full max-w-[22rem]">
      <defs>
        <linearGradient id="lp-linen" x1="0" x2="1">
          <stop offset="0" stopColor="#d9c3b6" />
          <stop offset=".45" stopColor="#f3e7df" />
          <stop offset="1" stopColor="#c9b0a2" />
        </linearGradient>
        <linearGradient id="lp-wood" x1="0" x2="1">
          <stop offset="0" stopColor="#5a3a2c" />
          <stop offset=".5" stopColor="#8a5d45" />
          <stop offset="1" stopColor="#4a2e22" />
        </linearGradient>
      </defs>

      {/* Back halves of the rings, behind the body. */}
      {(Object.keys(RINGS) as PointId[]).map((id) => (
        <path
          key={`b-${id}`}
          d={arc(RINGS[id]!, false)}
          fill="none"
          strokeDasharray="5 4"
          strokeWidth={width(id)}
          className={cn(tape(id), "opacity-25")}
        />
      ))}

      {/* Stand */}
      <rect x="156" y="344" width="8" height="92" rx="3" fill="url(#lp-wood)" />
      <path
        d="M160 432 L104 466 M160 432 L216 466 M160 432 L160 472"
        stroke="url(#lp-wood)"
        strokeWidth="7"
        strokeLinecap="round"
      />

      {/* Neck and cap */}
      <rect x="143" y="34" width="34" height="34" rx="4" fill="url(#lp-linen)" />
      <ellipse cx="160" cy="34" rx="20" ry="6" fill="url(#lp-wood)" />
      <circle cx="160" cy="24" r="6" fill="url(#lp-wood)" />

      {/* Body, seams and a pin cushion's worth of detail */}
      <path d={BODY} fill="url(#lp-linen)" stroke="#a9897a" strokeWidth="1.5" />
      <g fill="none" stroke="#8c6a5c" strokeOpacity=".35" strokeWidth="1.2" strokeDasharray="3 3">
        <path d="M160 68 V344" />
        <path d="M122 88 C126 130 118 168 124 206 C128 232 138 246 136 270 C134 296 126 316 126 342" />
        <path d="M198 88 C194 130 202 168 196 206 C192 232 182 246 184 270 C186 296 194 316 194 342" />
      </g>
      <g>
        <circle cx="110" cy="150" r="3.2" fill="#7a2f55" />
        <path d="M110 150 L128 140" stroke="#cfc4c9" strokeWidth="1.2" />
        <circle cx="205" cy="270" r="3.2" fill="#e2b36a" />
        <path d="M205 270 L190 258" stroke="#cfc4c9" strokeWidth="1.2" />
      </g>

      {/* Front halves of the rings */}
      {(Object.keys(RINGS) as PointId[]).map((id) => (
        <path
          key={`f-${id}`}
          d={arc(RINGS[id]!, true)}
          fill="none"
          strokeDasharray="5 4"
          strokeWidth={width(id)}
          className={tape(id)}
        />
      ))}

      {/* Shoulder: straight across, with end stops */}
      <g className={tape("shoulder")} strokeWidth={width("shoulder")}>
        <path d="M88 96 H232" strokeDasharray="5 4" />
        <path d="M88 89 V103 M232 89 V103" strokeDasharray="none" />
      </g>

      {/* Length: nape to hem, beside the form */}
      <g className={tape("length")} strokeWidth={width("length")}>
        <path d="M258 70 V340" strokeDasharray="5 4" />
        <path d="M251 70 H265 M251 340 H265" strokeDasharray="none" />
      </g>

      {/* The value pill */}
      <g transform={`translate(${label.x} ${label.y})`}>
        <g key={active} className="lp-pop">
          <rect x="0" y="-13" width="74" height="26" rx="13" fill="var(--lp-ink)" />
          <circle cx="13" cy="0" r="4" fill="var(--lp-brass)" />
          <text x="23" y="4.5" fontSize="12.5" fontWeight="600" fill="#fbeff5" fontFamily="Inter, sans-serif">
            {value}
          </text>
        </g>
      </g>
    </svg>
  );
}
