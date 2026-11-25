/**
 * One series of counts over time as bars: one hue (the brand colour), no legend (the card's title
 * names the series), bars anchored to the baseline with rounded tops and a 2px gap, a hover label
 * per bar, and a visually hidden table with every value for screen readers.
 */
export function TrendBars({
  points,
  caption,
  valueLabel,
  height = "h-24",
}: {
  points: { label: string; value: number }[];
  /** What the numbers are, for the hidden table: "Businesses that signed up, per week". */
  caption: string;
  /** Words after the number in the hover label: "sign-ups". */
  valueLabel: string;
  height?: string;
}) {
  const max = Math.max(1, ...points.map((p) => p.value));
  const first = points[0];
  const last = points.at(-1);
  return (
    <div>
      <div className={`flex ${height} items-end gap-0.5`} aria-hidden>
        {points.map((p) => (
          <div key={p.label} className="group relative flex h-full flex-1 items-end">
            <div
              className="w-full rounded-t bg-brand"
              style={{
                height: p.value ? `${Math.max(4, (p.value / max) * 100)}%` : "2px",
                opacity: p.value ? 1 : 0.25,
              }}
            />
            <span className="pointer-events-none absolute bottom-full left-1/2 z-10 mb-1 hidden -translate-x-1/2 rounded bg-fg px-2 py-1 text-xs whitespace-nowrap text-canvas group-hover:block">
              {p.label}: {p.value.toLocaleString()} {valueLabel}
            </span>
          </div>
        ))}
      </div>
      <div className="mt-1 flex justify-between text-xs text-fg-subtle" aria-hidden>
        <span>{first?.label}</span>
        <span>
          {last?.label} · {last?.value.toLocaleString()} {valueLabel}
        </span>
      </div>
      <table className="sr-only">
        <caption>{caption}</caption>
        <thead>
          <tr>
            <th>Period</th>
            <th>Value</th>
          </tr>
        </thead>
        <tbody>
          {points.map((p) => (
            <tr key={p.label}>
              <td>{p.label}</td>
              <td>{p.value}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
