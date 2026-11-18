import type { MeasurementUnit } from "../../types/auth.types";
import { cn } from "../../utils/cn";
import { formatDelta, type Build, type Landmark, type Placed } from "../../utils/bodyMap";

/**
 * A front-view mannequin whose shape follows the numbers: a bigger waist gives
 * a wider waist, a longer sleeve a longer arm. It is illustrative, not a scan:
 * every part starts from average proportions for the chosen build and is
 * scaled by what was measured.
 */

type Pt = [number, number];

const CX = 192;
const WIDTH = 392;
const HEIGHT = 440;
const PX_PER_INCH = 6;
const FLOOR = 428;
/** The top of the drawing, just above the head, so there is no dead space above it. */
const TOP = 24;

/** Heights of the body points (a 5'6" figure at 6px per inch). */
const Y = {
  neckTop: 90,
  neck: 103,
  shoulder: 113,
  bust: 145,
  underbust: 162,
  waist: 185,
  hip: 220,
  crotch: 244,
  thigh: 262,
  knee: 317,
  calf: 360,
  ankle: 410,
  foot: 424,
};

type SizedKey =
  | "neck"
  | "shoulder"
  | "bust"
  | "underbust"
  | "waist"
  | "hip"
  | "thigh"
  | "knee"
  | "calf"
  | "ankle"
  | "bicep"
  | "wrist"
  | "sleeve";
type Sized = Record<SizedKey, number>;

/** Average measurements (inches) each figure is drawn at until something is measured. */
const REFERENCE: Record<Build, Sized> = {
  female: {
    neck: 13.5,
    shoulder: 15.5,
    bust: 36,
    underbust: 30,
    waist: 29,
    hip: 39,
    thigh: 22.5,
    knee: 14.5,
    calf: 14,
    ankle: 8.8,
    bicep: 10.5,
    wrist: 6,
    sleeve: 22,
  },
  male: {
    neck: 15.5,
    shoulder: 18,
    bust: 40,
    underbust: 38,
    waist: 34,
    hip: 39,
    thigh: 23,
    knee: 15.5,
    calf: 15,
    ankle: 9.5,
    bicep: 12.5,
    wrist: 7,
    sleeve: 25,
  },
  neutral: {
    neck: 14.5,
    shoulder: 16.75,
    bust: 38,
    underbust: 34,
    waist: 31.5,
    hip: 39,
    thigh: 22.75,
    knee: 15,
    calf: 14.5,
    ankle: 9.15,
    bicep: 11.5,
    wrist: 6.5,
    sleeve: 23.5,
  },
};

/** Shoulders slope more on the female figure and sit squarer on the male. */
const SHOULDER_DROP: Record<Build, number> = { female: 3, neutral: 1.5, male: 0 };
const HEAD_SIZE: Record<Build, { rx: number; ry: number }> = {
  female: { rx: 18, ry: 26.5 },
  neutral: { rx: 19, ry: 27 },
  male: { rx: 20, ry: 27.5 },
};

const clamp = (n: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, n));
const r1 = (n: number) => Math.round(n * 10) / 10;
const mirror = ([x, y]: Pt): Pt => [2 * CX - x, y];
const rad = (deg: number) => (deg * Math.PI) / 180;

/** Sizes to draw: measured values, kept within a believable range so one typo cannot wreck the figure. */
function sizesFor(placed: Placed[], build: Build): Sized {
  const reference = REFERENCE[build];
  const sized = { ...reference };
  for (const p of placed) {
    if (p.landmark in reference) {
      const key = p.landmark as SizedKey;
      sized[key] = clamp(p.inches, reference[key] * 0.55, reference[key] * 1.7);
    }
  }
  return sized;
}

/** A smooth curve through the points (Catmull-Rom as cubic Béziers), continuing from the current point. */
function spline(pts: Pt[]): string {
  let d = "";
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[i - 1] ?? pts[i];
    const p1 = pts[i];
    const p2 = pts[i + 1];
    const p3 = pts[i + 2] ?? p2;
    d += `C${r1(p1[0] + (p2[0] - p0[0]) / 6)} ${r1(p1[1] + (p2[1] - p0[1]) / 6)} ${r1(p2[0] - (p3[0] - p1[0]) / 6)} ${r1(p2[1] - (p3[1] - p1[1]) / 6)} ${r1(p2[0])} ${r1(p2[1])}`;
  }
  return d;
}

const at = ([x, y]: Pt) => `${r1(x)} ${r1(y)}`;

interface Ring {
  cx: number;
  cy: number;
  rx: number;
  /** Degrees, for a ring round a tilted arm. */
  rot?: number;
}

interface Arm {
  closed: string;
  open: string;
  /** The line along the arm, shoulder to wrist. */
  from: Pt;
  to: Pt;
  /** The middle and width of the arm a fraction of the way down it. */
  at: (t: number) => { centre: Pt; width: number };
}

interface Shape {
  /** Torso and both legs as one outline. */
  body: string;
  arms: Arm[];
  rings: Partial<Record<Landmark, Ring>>;
  shoulder: { x1: number; x2: number; y: number };
}

const ARM_TILT = 6;

function armFor(side: -1 | 1, shoulderHalf: number, shoulderY: number, length: number, bicep: number, wrist: number): Arm {
  const s = Math.sin(rad(ARM_TILT));
  const c = Math.cos(rad(ARM_TILT));
  const u: Pt = [side * s, c]; // down the arm, drifting outwards
  const n: Pt = [-side * c, s]; // across the arm, towards the body
  // The arm is as wide as the bicep a fifth of the way down, and tapers to the wrist.
  const top = Math.max((bicep - 0.2 * wrist) / 0.8, wrist);
  const a0: Pt = [CX + side * shoulderHalf, shoulderY];
  const a1: Pt = [a0[0] + n[0] * top, a0[1] + n[1] * top];
  const c0: Pt = [a0[0] + (n[0] * top) / 2, a0[1] + (n[1] * top) / 2];
  const c1: Pt = [c0[0] + u[0] * length, c0[1] + u[1] * length];
  const b0: Pt = [c1[0] - (n[0] * wrist) / 2, c1[1] - (n[1] * wrist) / 2];
  const b1: Pt = [c1[0] + (n[0] * wrist) / 2, c1[1] + (n[1] * wrist) / 2];
  const sweep = side === 1 ? 1 : 0;
  const cap = `L${at(b0)}A${wrist / 2} ${wrist / 2} 0 0 ${sweep} ${at(b1)}`;
  // For the dashed comparison outline, stop the inner edge where the arm leaves the torso.
  const hidden: Pt = [b1[0] + (a1[0] - b1[0]) * 0.7, b1[1] + (a1[1] - b1[1]) * 0.7];
  return {
    closed: `M${at(a0)}${cap}L${at(a1)}Z`,
    open: `M${at(a0)}${cap}L${at(hidden)}`,
    from: c0,
    to: c1,
    at: (t) => ({
      centre: [c0[0] + u[0] * length * t, c0[1] + u[1] * length * t],
      width: top + (wrist - top) * t,
    }),
  };
}

function shapeFor(sz: Sized, build: Build): Shape {
  const shoulderHalf = sz.shoulder * 3;
  const shoulderY = Y.shoulder + SHOULDER_DROP[build];
  const thighW = sz.thigh * 1.55;
  const kneeW = sz.knee * 1.6;
  const calfW = sz.calf * 1.6;
  const ankleW = sz.ankle * 1.7;
  // Legs sit either side of the middle; wide legs shift outwards rather than cross it.
  const legMid = (mid: number, w: number) => Math.min(mid, CX - 3.5 - w / 2);
  const thighMid = legMid(CX - (4 + thighW / 2), thighW);
  const kneeMid = legMid(CX - 18, kneeW);
  const calfMid = legMid(CX - 17, calfW);
  const ankleMid = legMid(CX - 14, ankleW);

  const outer: Pt[] = [
    [CX - sz.neck, Y.neckTop],
    [CX - sz.neck * 1.08, Y.neck],
    [CX - shoulderHalf, shoulderY],
    [CX - sz.bust, Y.bust],
    [CX - sz.underbust, Y.underbust],
    [CX - sz.waist, Y.waist],
    [CX - sz.hip, Y.hip],
    [thighMid - thighW / 2, Y.thigh],
    [kneeMid - kneeW / 2, Y.knee],
    [calfMid - calfW / 2, Y.calf],
    [ankleMid - ankleW / 2, Y.ankle],
    [ankleMid - ankleW / 2, Y.foot],
  ];
  const inner: Pt[] = [
    [ankleMid + ankleW / 2, Y.foot],
    [ankleMid + ankleW / 2, Y.ankle],
    [calfMid + calfW / 2, Y.calf],
    [kneeMid + kneeW / 2, Y.knee],
    [thighMid + thighW / 2, Y.thigh],
    [CX - 3, Y.crotch],
  ];
  const rightInner = inner.map(mirror).reverse();
  const rightOuter = outer.map(mirror).reverse();

  const body =
    `M${at(outer[0])}${spline(outer)}L${at(inner[0])}${spline(inner)}` +
    `L${at(rightInner[0])}${spline(rightInner)}L${at(rightOuter[0])}${spline(rightOuter)}Z`;

  const sleeve = sz.sleeve * PX_PER_INCH;
  const bicepPx = sz.bicep * 1.6;
  const wristPx = sz.wrist * 1.75;
  const arms = [
    armFor(-1, shoulderHalf, shoulderY, sleeve, bicepPx, wristPx),
    armFor(1, shoulderHalf, shoulderY, sleeve, bicepPx, wristPx),
  ];

  // The tapes round the arm go on the right arm, perpendicular to it.
  const armRing = (t: number): Ring => {
    const { centre, width } = arms[1].at(t);
    return { cx: centre[0], cy: centre[1], rx: width / 2, rot: -ARM_TILT };
  };
  const ring = (cx: number, cy: number, rx: number): Ring => ({ cx, cy, rx });
  return {
    body,
    arms,
    rings: {
      neck: ring(CX, Y.neck, sz.neck * 1.04),
      bust: ring(CX, Y.bust, sz.bust),
      underbust: ring(CX, Y.underbust, sz.underbust),
      waist: ring(CX, Y.waist, sz.waist),
      hip: ring(CX, Y.hip, sz.hip),
      thigh: ring(thighMid, Y.thigh, thighW / 2),
      knee: ring(kneeMid, Y.knee, kneeW / 2),
      calf: ring(calfMid, Y.calf, calfW / 2),
      ankle: ring(ankleMid, Y.ankle, ankleW / 2),
      bicep: armRing(0.2),
      wrist: armRing(0.92),
    },
    shoulder: { x1: CX - shoulderHalf, x2: CX + shoulderHalf, y: shoulderY },
  };
}

const headPath = (build: Build) => {
  const { rx, ry } = HEAD_SIZE[build];
  return `M${CX - rx} 62a${rx} ${ry} 0 1 0 ${rx * 2} 0a${rx} ${ry} 0 1 0 ${-rx * 2} 0Z`;
};

const arc = (r: Ring, front: boolean) => {
  const ry = clamp(r.rx * 0.2, 2.5, 8);
  return `M${r1(r.cx - r.rx)} ${r.cy}A${r1(r.rx)} ${r1(ry)} 0 0 ${front ? 0 : 1} ${r1(r.cx + r.rx)} ${r.cy}`;
};

const PILL_W = 92;
const PILL_H = 36;
/** Girths are labelled down the left; the shoulder, arm and length tapes down the right. */
const LEFT_SIDE: Landmark[] = ["neck", "bust", "underbust", "waist", "hip", "thigh", "knee", "calf", "ankle"];
const LENGTHS: Landmark[] = ["length", "trouserLength"];

interface Mark {
  placed: Placed;
  /** Where the tape is, so the label can point at it. */
  anchor: Pt;
  left: boolean;
}

/**
 * Where to put labels so none overlap and each stays as close to its tape as
 * possible: the least total movement (isotonic regression), clamped to the picture.
 */
function spread(ys: number[]): number[] {
  const order = ys.map((_, i) => i).sort((a, b) => ys[a] - ys[b]);
  const gap = PILL_H + 3;
  // Take the gaps out, so "at least a gap apart" becomes "in order", then pool the ones out of order.
  const blocks: { sum: number; count: number }[] = [];
  order.forEach((index, k) => {
    blocks.push({ sum: ys[index] - k * gap, count: 1 });
    while (blocks.length > 1) {
      const last = blocks[blocks.length - 1];
      const before = blocks[blocks.length - 2];
      if (before.sum / before.count <= last.sum / last.count) break;
      before.sum += last.sum;
      before.count += last.count;
      blocks.pop();
    }
  });
  const levels = blocks.flatMap((b) => Array<number>(b.count).fill(b.sum / b.count));
  const lo = TOP + PILL_H / 2;
  const hi = Math.max(lo, HEIGHT - PILL_H / 2 - (order.length - 1) * gap);
  const out = [...ys];
  order.forEach((index, k) => {
    out[index] = clamp(levels[k], lo, hi) + k * gap;
  });
  return out;
}

const short = (name: string) => (name.length > 14 ? `${name.slice(0, 13)}…` : name);

interface Props {
  placed: Placed[];
  unit: MeasurementUnit;
  /** Which silhouette to draw. */
  build?: Build;
  /** An older set, drawn as a dashed outline behind the tapes, with the change on each label. */
  compare?: Placed[];
  /** Hide the value labels (the small preview beside the form has the inputs for that). */
  labels?: boolean;
  /** The measurement being looked at; the rest fade back. */
  active?: Landmark | null;
  className?: string;
}

export function BodyDiagram({ placed, unit, build = "neutral", compare, labels = true, active = null, className }: Props) {
  const shape = shapeFor(sizesFor(placed, build), build);
  const ghost = compare ? shapeFor(sizesFor(compare, build), build) : null;
  const by = new Map(placed.map((p) => [p.landmark, p]));

  const tape = (landmark: Landmark) =>
    cn("stroke-brand transition-opacity", active && active !== landmark && "opacity-30");
  const stroke = (landmark: Landmark) => (active === landmark ? 3.6 : 2.2);

  // Length tapes run beside the body: the first from the shoulder, trousers from the waist.
  const lengthBars = LENGTHS.filter((l) => by.has(l)).map((landmark, i) => {
    const y0 = landmark === "length" ? Y.shoulder - 6 : Y.waist;
    const wanted = y0 + by.get(landmark)!.inches * PX_PER_INCH;
    return { landmark, x: CX + 88 + i * 11, y0, y1: Math.min(wanted, FLOOR), off: wanted > FLOOR };
  });

  const marks: Mark[] = [];
  for (const p of placed) {
    const ring = shape.rings[p.landmark];
    if (ring) {
      // Rings point from their near edge: left-hand labels from the left end, right-hand from the right.
      const left = LEFT_SIDE.includes(p.landmark);
      const a = rad(ring.rot ?? 0);
      const dx = ring.rx * Math.cos(a);
      const dy = ring.rx * Math.sin(a);
      marks.push({ placed: p, anchor: left ? [ring.cx - dx, ring.cy - dy] : [ring.cx + dx, ring.cy + dy], left });
    } else if (p.landmark === "shoulder") {
      marks.push({ placed: p, anchor: [shape.shoulder.x2, shape.shoulder.y], left: false });
    } else if (p.landmark === "sleeve") {
      const { from, to } = shape.arms[1];
      marks.push({ placed: p, anchor: [(from[0] + to[0]) / 2, (from[1] + to[1]) / 2], left: false });
    } else {
      const bar = lengthBars.find((b) => b.landmark === p.landmark);
      if (bar) marks.push({ placed: p, anchor: [bar.x, (bar.y0 + bar.y1) / 2], left: false });
    }
  }
  const sides = [true, false].map((left) => {
    const list = marks.filter((m) => m.left === left);
    const ys = spread(list.map((m) => m.anchor[1]));
    return list.map((m, i) => ({ ...m, y: ys[i] }));
  });

  const summary = placed.map((p) => `${p.name} ${p.value} ${unit}`).join(", ");
  // Without labels, crop to the body and the length tapes beside it.
  const view = labels ? `0 ${TOP} ${WIDTH} ${HEIGHT - TOP}` : `${CX - 84} ${TOP} 192 ${HEIGHT - TOP}`;
  const silhouette = [shape.body, ...shape.arms.map((a) => a.closed), headPath(build)];

  return (
    <svg
      viewBox={view}
      role="img"
      aria-label={`Body diagram. ${summary}`}
      className={cn("h-auto w-full", className)}
      data-cy="body-diagram"
    >
      <line x1={CX - 70} x2={CX + 70} y1={FLOOR} y2={FLOOR} className="stroke-line" strokeWidth="2" strokeLinecap="round" />

      {/* Outline first, then fill over it, so overlapping parts read as one shape. */}
      <g className="fill-none stroke-line-strong" strokeWidth="2.6" strokeLinejoin="round">
        {silhouette.map((d, i) => (
          <path key={i} d={d} />
        ))}
      </g>
      <g className="fill-subtle stroke-none">
        {silhouette.map((d, i) => (
          <path key={i} d={d} />
        ))}
      </g>

      {ghost && (
        <g className="fill-none stroke-fg-subtle" strokeWidth="1.6" strokeDasharray="5 4" strokeLinejoin="round">
          <path d={ghost.body} />
          {ghost.arms.map((a, i) => (
            <path key={i} d={a.open} />
          ))}
        </g>
      )}

      {/* Rings round the body: the far half dashed, the near half solid. */}
      {(Object.keys(shape.rings) as Landmark[])
        .filter((l) => by.has(l))
        .map((l) => {
          const r = shape.rings[l]!;
          return (
            <g
              key={l}
              fill="none"
              strokeWidth={stroke(l)}
              strokeLinecap="round"
              className={tape(l)}
              transform={r.rot ? `rotate(${r.rot} ${r1(r.cx)} ${r1(r.cy)})` : undefined}
            >
              <path d={arc(r, false)} strokeDasharray="4 4" opacity=".45" />
              <path d={arc(r, true)} />
            </g>
          );
        })}

      {by.has("shoulder") && (
        <g fill="none" strokeWidth={stroke("shoulder")} strokeLinecap="round" className={tape("shoulder")}>
          <path d={`M${r1(shape.shoulder.x1)} ${shape.shoulder.y}H${r1(shape.shoulder.x2)}`} />
          <path
            d={`M${r1(shape.shoulder.x1)} ${shape.shoulder.y - 6}v12M${r1(shape.shoulder.x2)} ${shape.shoulder.y - 6}v12`}
          />
        </g>
      )}

      {by.has("sleeve") && (
        <g fill="none" strokeWidth={stroke("sleeve")} strokeLinecap="round" className={tape("sleeve")}>
          <path d={`M${at(shape.arms[1].from)}L${at(shape.arms[1].to)}`} />
        </g>
      )}

      {lengthBars.map((bar) => (
        <g key={bar.landmark} fill="none" strokeWidth={stroke(bar.landmark)} strokeLinecap="round" className={tape(bar.landmark)}>
          <path d={`M${CX + 24} ${bar.y0}H${bar.x}M${CX + 24} ${r1(bar.y1)}H${bar.x}`} strokeWidth="1" strokeDasharray="2 4" opacity=".5" />
          <path d={`M${bar.x} ${bar.y0}V${r1(bar.y1)}`} strokeDasharray="6 4" />
          <path d={`M${bar.x - 5} ${bar.y0}h10M${bar.x - 5} ${r1(bar.y1)}h10`} />
          {bar.off && <path d={`M${bar.x - 4} ${r1(bar.y1) - 9}l4 6l4 -6`} />}
        </g>
      ))}

      {labels &&
        sides.map((list, side) =>
          list.map((m) => {
            const x = side === 0 ? 0 : WIDTH - PILL_W;
            const edge = side === 0 ? PILL_W : x;
            const { placed: p } = m;
            const prior = compare?.find((c) => c.landmark === p.landmark);
            const delta = prior ? formatDelta(prior.inches, p.inches, unit) : null;
            return (
              <g key={p.landmark} className={cn("transition-opacity", active && active !== p.landmark && "opacity-30")}>
                <path d={`M${at(m.anchor)}L${edge} ${r1(m.y)}`} className="stroke-line-strong" strokeWidth="1" fill="none" />
                <circle cx={m.anchor[0]} cy={m.anchor[1]} r="2.8" className="fill-brand" />
                <g transform={`translate(${x} ${r1(m.y - PILL_H / 2)})`}>
                  <title>{`${p.name}: ${p.value} ${unit}`}</title>
                  <rect width={PILL_W} height={PILL_H} rx="9" className="fill-surface stroke-line-strong" strokeWidth="1" />
                  <text x="9" y="14.5" fontSize="10" className="fill-fg-subtle">
                    {short(p.name)}
                  </text>
                  <text x="9" y="29.5" fontSize="13.5" fontWeight="600" className="fill-fg">
                    {p.value} {unit}
                  </text>
                  {delta && (
                    <text x={PILL_W - 8} y="29.5" fontSize="11.5" fontWeight="600" textAnchor="end" className="fill-link">
                      {delta}
                    </text>
                  )}
                </g>
              </g>
            );
          }),
        )}
    </svg>
  );
}
