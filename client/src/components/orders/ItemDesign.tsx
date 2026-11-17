import { Palette } from "lucide-react";
import { useDesign } from "../../hooks/useTeam";

/** The catalogue design an order item is based on: thumbnail and name. */
export function ItemDesign({ id }: { id: string }) {
  const design = useDesign(id).data;
  if (!design) return null;
  return (
    <a
      href={design.coverUrl ?? undefined}
      target="_blank"
      rel="noreferrer"
      className="mt-2 inline-flex items-center gap-2 rounded-lg border border-line p-1 pr-3 text-xs text-fg-muted hover:bg-subtle"
      data-cy="order-item-design-link"
    >
      {design.coverUrl ? (
        <img src={design.coverUrl} alt="" className="size-10 rounded object-cover" />
      ) : (
        <Palette className="m-2 size-5 text-fg-subtle" aria-hidden />
      )}
      <span>
        Design: <span className="font-medium text-fg">{design.name}</span>
      </span>
    </a>
  );
}
