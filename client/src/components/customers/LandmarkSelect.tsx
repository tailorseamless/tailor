import type { FieldLandmark } from "../../types/customer.types";
import { LANDMARK_CHOICES, landmarkFor, landmarkLabel } from "../../utils/bodyMap";
import { Select } from "../shared/Field";

/**
 * Where on the body one template measurement is taken, so the figure marks it there. Left on "Guess" the app reads
 * the words in the name, and the option says what it would pick, so a wrong guess shows up right here.
 */
export function LandmarkSelect({
  name,
  templateName,
  value,
  onChange,
  className,
}: {
  /** The measurement's name as typed so far. */
  name: string;
  /** The template's name: a bare "Length" in a trousers template means waist-down. */
  templateName: string;
  value: FieldLandmark | null;
  onChange: (value: FieldLandmark | null) => void;
  className?: string;
}) {
  const guess = landmarkFor(name, templateName);
  return (
    <Select
      aria-label={`Where ${name.trim() || "this measurement"} sits on the body`}
      value={value ?? ""}
      onChange={(e) => onChange(e.target.value === "" ? null : (e.target.value as FieldLandmark))}
      className={className}
      data-cy="template-landmark"
    >
      <option value="">
        {/* Short, so it fits the closed box: the parenthesis of the long labels ("(gown, shirt, jacket)") is dropped. */}
        {guess ? `Guess: ${landmarkLabel(guess).replace(/\s*\(.*\)$/, "")}` : "Guess: none found, not shown"}
      </option>
      {LANDMARK_CHOICES.map((choice) => (
        <option key={choice.value} value={choice.value}>
          {choice.label}
        </option>
      ))}
      <option value="none">Don't show on the figure</option>
    </Select>
  );
}
