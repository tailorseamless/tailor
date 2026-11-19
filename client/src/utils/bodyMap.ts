import type { MeasurementUnit } from "../types/auth.types";
import type { CustomerGender, FieldLandmark, Landmark, MeasurementValue } from "../types/customer.types";

export type { Landmark };

/** The spots a template field can be set to, in the words the template editor shows, top of the body first. */
export const LANDMARK_CHOICES: { value: Landmark; label: string }[] = [
  { value: "neck", label: "Neck" },
  { value: "shoulder", label: "Shoulder" },
  { value: "bust", label: "Chest / bust" },
  { value: "underbust", label: "Under the bust" },
  { value: "waist", label: "Waist" },
  { value: "hip", label: "Hip / seat" },
  { value: "thigh", label: "Thigh" },
  { value: "knee", label: "Knee" },
  { value: "calf", label: "Calf" },
  { value: "ankle", label: "Ankle / trouser bottom" },
  { value: "bicep", label: "Upper arm (round)" },
  { value: "wrist", label: "Wrist / cuff" },
  { value: "sleeve", label: "Sleeve length" },
  { value: "length", label: "Length from the shoulder (gown, shirt, jacket)" },
  { value: "trouserLength", label: "Length from the waist (trousers, skirt)" },
];

export const landmarkLabel = (spot: Landmark): string => LANDMARK_CHOICES.find((c) => c.value === spot)?.label ?? spot;

const isLandmark = (value: unknown): value is Landmark => LANDMARK_CHOICES.some((c) => c.value === value);

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
    // "Short gown length" is a short gown, not shorts: only "shorts" itself means the garment.
    const lowerBody = /trouser|\bpants?\b|\bshorts\b|skirt|waist/;
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
  // A trouser's "base" is its bottom opening, which sits at the ankle.
  if (/ankle|\bbase\b|leg opening|trouser (bottom|hem)/.test(n)) return "ankle";
  return null;
}

/**
 * Where a measurement goes on the figure. What its template field chose wins: a spot, or `none` to keep it off the
 * figure. With no choice (older templates, custom rows) it is guessed from the words in the name.
 */
export function spotFor(name: string, templateName?: string | null, chosen?: FieldLandmark | null): Landmark | null {
  if (chosen === "none") return null;
  if (isLandmark(chosen)) return chosen;
  return landmarkFor(name, templateName);
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
    const landmark = spotFor(v.name, templateName, v.landmark);
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
