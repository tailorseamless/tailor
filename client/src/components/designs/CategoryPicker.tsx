import { useState } from "react";
import { useDesignCategories } from "../../hooks/useTeam";
import { Field, Input, Select } from "../shared/Field";

/** Styles tailors and designers most often sort their work by. */
export const POPULAR_CATEGORIES = [
  "Agbada",
  "Kaftan",
  "Senator",
  "Ankara",
  "Aso Ebi",
  "Iro & Buba",
  "Bridal gown",
  "Evening gown",
  "Corset",
  "Dress",
  "Skirt & blouse",
  "Jumpsuit",
  "Suit",
  "Shirt",
  "Trousers",
  "Children's wear",
  "School uniform",
  "Casual wear",
] as const;

const OTHER = "__other__";
const same = (a: string, b: string) => a.toLowerCase() === b.toLowerCase();

interface Props {
  value: string;
  onChange: (category: string) => void;
}

/**
 * A dropdown of popular categories, then the ones this business already uses,
 * then "Other" to type a new one (which then shows up in "Your categories" next time).
 */
export function CategoryPicker({ value, onChange }: Props) {
  const mine = useDesignCategories().data ?? [];
  const [typing, setTyping] = useState(false);

  const popular = POPULAR_CATEGORIES.find((p) => same(p, value));
  const yours = [...mine, ...(value ? [value] : [])]
    .filter((c, i, all) => all.findIndex((x) => same(x, c)) === i)
    .filter((c) => !POPULAR_CATEGORIES.some((p) => same(p, c)))
    .sort((a, b) => a.localeCompare(b));
  const selected = typing ? OTHER : (popular ?? value);

  return (
    <Field label="Category (optional)" hint="Helps you and your customers browse by type of clothing.">
      {(p) => (
        <>
          <Select
            {...p}
            value={selected}
            onChange={(e) => {
              const next = e.target.value;
              setTyping(next === OTHER);
              onChange(next === OTHER ? "" : next);
            }}
            data-cy="design-category"
          >
            <option value="">No category</option>
            <optgroup label="Popular">
              {POPULAR_CATEGORIES.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </optgroup>
            {yours.length > 0 && (
              <optgroup label="Your categories">
                {yours.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </optgroup>
            )}
            <option value={OTHER}>Other: type your own…</option>
          </Select>
          {typing && (
            <Input
              aria-label="Your category name"
              className="mt-2"
              placeholder="e.g. Hijab, Native wear"
              value={value}
              maxLength={60}
              onChange={(e) => onChange(e.target.value)}
              data-cy="design-category-custom"
            />
          )}
        </>
      )}
    </Field>
  );
}
