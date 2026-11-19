import type { BodyLandmark } from "../dto/measurement.dto";

/**
 * Starter templates every new business gets (PRD §4.3). They are ordinary
 * rows afterwards: the business can rename, edit or delete any of them.
 * Each measurement says where it sits on the body figure, so none of them rely on guessing from its name.
 */
export const DEFAULT_MEASUREMENT_TEMPLATES: { name: string; fields: { name: string; landmark: BodyLandmark }[] }[] = [
  {
    name: "Shirt",
    fields: [
      { name: "Neck", landmark: "neck" },
      { name: "Chest", landmark: "bust" },
      { name: "Shoulder", landmark: "shoulder" },
      { name: "Sleeve", landmark: "sleeve" },
      { name: "Length", landmark: "length" },
    ],
  },
  {
    name: "Trousers",
    fields: [
      { name: "Waist", landmark: "waist" },
      { name: "Hip", landmark: "hip" },
      { name: "Thigh", landmark: "thigh" },
      { name: "Knee", landmark: "knee" },
      { name: "Length", landmark: "trouserLength" },
    ],
  },
  {
    name: "Gown",
    fields: [
      { name: "Bust", landmark: "bust" },
      { name: "Waist", landmark: "waist" },
      { name: "Hip", landmark: "hip" },
      { name: "Shoulder", landmark: "shoulder" },
      { name: "Gown length", landmark: "length" },
    ],
  },
  {
    name: "Senator",
    fields: [
      { name: "Chest", landmark: "bust" },
      { name: "Shoulder", landmark: "shoulder" },
      { name: "Sleeve", landmark: "sleeve" },
      { name: "Waist", landmark: "waist" },
      { name: "Trouser length", landmark: "trouserLength" },
    ],
  },
  {
    name: "Suit",
    fields: [
      { name: "Chest", landmark: "bust" },
      { name: "Waist", landmark: "waist" },
      { name: "Shoulder", landmark: "shoulder" },
      { name: "Sleeve", landmark: "sleeve" },
      { name: "Jacket length", landmark: "length" },
      { name: "Trouser length", landmark: "trouserLength" },
    ],
  },
];
