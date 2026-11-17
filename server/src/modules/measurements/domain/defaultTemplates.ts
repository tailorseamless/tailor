/**
 * Starter templates every new business gets (PRD §4.3). They are ordinary
 * rows afterwards: the business can rename, edit or delete any of them.
 */
export const DEFAULT_MEASUREMENT_TEMPLATES: { name: string; fields: string[] }[] = [
  { name: "Shirt", fields: ["Neck", "Chest", "Shoulder", "Sleeve", "Length"] },
  { name: "Trousers", fields: ["Waist", "Hip", "Thigh", "Knee", "Length"] },
  { name: "Gown", fields: ["Bust", "Waist", "Hip", "Shoulder", "Gown length"] },
  { name: "Senator", fields: ["Chest", "Shoulder", "Sleeve", "Waist", "Trouser length"] },
  { name: "Suit", fields: ["Chest", "Waist", "Shoulder", "Sleeve", "Jacket length", "Trouser length"] },
];
