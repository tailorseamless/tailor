import type { MeasurementUnit } from "../types/auth.types";
import type { CustomerGender, MeasurementValue } from "../types/customer.types";

/**
 * Where on the body a measurement is taken. `length` runs from the shoulder
 * down (gown, jacket, shirt…); `trouserLength` runs from the waist down.
 */
export type Landmark =
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
  | "sleeve"
  | "length"
  | "trouserLength";

/** Which silhouette to draw. */
export type Build = "female" | "male" | "neutral";

export const BUILDS: { value: Build; label: string }[] = [
  { value: "female", label: "Female" },
  { value: "male", label: "Male" },
  { value: "neutral", label: "Neutral" },
];

/** The figure for a customer's recorded gender; neutral when none is set. */
export const buildFor = (gender: CustomerGender | null | undefined): Build =>
  gender === "female" || gender === "male" ? gender : "neutral";

const normalise = (name: string) =>
  name
    .toLowerCase()
    .replace(/[^a-z\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();

/**
 * Template fields are free text, so match on the words in them. Anything we
 * can't place (or that spans two points, like "Shoulder to waist") returns
 * null and simply stays in the list without a spot on the figure.
 * `templateName` settles a bare "Length": a trousers template means waist-down.
 */
export function landmarkFor(name: string, templateName?: string | null): Landmark | null {
  const n = normalise(name);
  // "Shoulder to waist" and the like span two points, so they have no single spot.
  if (!n || /\b(to|from)\b/.test(n)) return null;

  if (/under ?bust|below bust/.test(n)) return "underbust";

  // Arms: "Round sleeve" is the upper arm; "Cuff" and "Wrist" the wrist; plain "Sleeve" the length.
  if (/sleeve|\barm\b|bicep|wrist|cuff/.test(n)) {
    if (/round|girth|bicep|upper arm/.test(n)) return "bicep";
    if (/wrist|cuff/.test(n)) return "wrist";
    return /width/.test(n) ? null : "sleeve";
  }
  if (/outseam/.test(n)) return "trouserLength";
  if (/inseam/.test(n)) return null;

  if (/length|\blen\b/.test(n)) {
    const lowerBody = /trouser|pant|short|skirt|waist/;
    if (lowerBody.test(n)) return "trouserLength";
    if (n === "length" && lowerBody.test(normalise(templateName ?? ""))) return "trouserLength";
    return "length";
  }

  if (/neck|collar/.test(n)) return "neck";
  if (/shoulder/.test(n)) return "shoulder";
  if (/bust|chest/.test(n)) return "bust";
  if (/waist/.test(n)) return "waist";
  if (/hip|seat|\bbum\b/.test(n)) return "hip";
  if (/thigh|\blap\b/.test(n)) return "thigh";
  if (/knee/.test(n)) return "knee";
  if (/calf/.test(n)) return "calf";
  if (/ankle/.test(n)) return "ankle";
  return null;
}

export interface Placed {
  name: string;
  landmark: Landmark;
  value: number;
  /** Always in inches, so figures and comparisons share one scale. */
  inches: number;
}

export const toInches = (value: number, unit: MeasurementUnit) => (unit === "cm" ? value / 2.54 : value);

/** The measurements we can place on the body. The first one wins when two share a spot. */
export function placeMeasurements(
  values: MeasurementValue[],
  unit: MeasurementUnit,
  templateName?: string | null,
): Placed[] {
  const placed = new Map<Landmark, Placed>();
  for (const v of values) {
    if (!(v.value > 0)) continue;
    const landmark = landmarkFor(v.name, templateName);
    if (landmark && !placed.has(landmark))
      placed.set(landmark, { name: v.name, landmark, value: v.value, inches: toInches(v.value, unit) });
  }
  return [...placed.values()];
}

/** "+1.5" / "−2" in the unit being shown, or null when nothing changed. */
export function formatDelta(from: number, to: number, unit: MeasurementUnit): string | null {
  const diff = Math.round((toUnit(to, unit) - toUnit(from, unit)) * 10) / 10;
  if (diff === 0) return null;
  return `${diff > 0 ? "+" : "−"}${Math.abs(diff)}`;
}

const toUnit = (inches: number, unit: MeasurementUnit) => (unit === "cm" ? inches * 2.54 : inches);
