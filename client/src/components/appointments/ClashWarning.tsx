import { fieldErrors, statusCode } from "../../utils/errors";

/** A 409 from the server lists what the new time overlaps; this shows it and lets them book anyway. */
export function clashesIn(err: unknown): { customerName?: string; localTime?: string }[] | null {
  if (statusCode(err) !== 409) return null;
  const list = fieldErrors(err).filter((e) => e.customerName || e.localTime || e.with);
  return list.length ? (list as { customerName?: string; localTime?: string }[]) : null;
}

export function ClashWarning({ clashes }: { clashes: { customerName?: string; localTime?: string }[] }) {
  return (
    <div role="alert" className="rounded-lg bg-warning-bg p-3 text-sm text-warning-fg" data-cy="clash-warning">
      <p className="font-medium">This overlaps with:</p>
      <ul className="mt-1 list-disc pl-5">
        {clashes.map((c, i) => (
          <li key={i}>
            {c.customerName ?? "Another appointment"}
            {c.localTime ? ` at ${c.localTime}` : ""}
          </li>
        ))}
      </ul>
      <p className="mt-1">Book anyway if that's fine.</p>
    </div>
  );
}
