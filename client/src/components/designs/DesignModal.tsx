import { ImagePlus, Star, Trash2 } from "lucide-react";
import { useRef, useState } from "react";
import { useOnboarding } from "../../contexts/OnboardingContext";
import { useToast } from "../../contexts/ToastContext";
import { useDesign, useDesignActions } from "../../hooks/useTeam";
import { useWorkspace } from "../../hooks/useWorkspace";
import type { Design, DesignVisibility } from "../../types/workspace.types";
import { cn } from "../../utils/cn";
import { errorMessage } from "../../utils/errors";
import { formatPriceRange } from "../../utils/money";
import {
  PICTURE_TYPES as TYPES,
  PICTURES_PER_ITEM as MAX_PICTURES,
  PICTURES_PER_REQUEST as MAX_PER_UPLOAD,
  pictureProblem,
} from "../../utils/pictures";
import { orNull } from "../../utils/validation";
import { Button } from "../shared/Button";
import { Field, FormError, Input, Textarea, Toggle } from "../shared/Field";
import { ConfirmDialog, Modal } from "../shared/Modal";
import { PendingThumb } from "../shared/PendingThumb";
import { Spinner } from "../shared/States";
import { CategoryPicker } from "./CategoryPicker";

const MAX_PRICE = 999_999_999;

/** What was typed in a price box: null when empty, undefined when it isn't a usable amount. */
function parsePrice(text: string): number | null | undefined {
  if (text.trim() === "") return null;
  const value = Number(text);
  return Number.isFinite(value) && value >= 0 && value <= MAX_PRICE ? Math.round(value * 100) / 100 : undefined;
}

/** Create a design, or view and edit one with its pictures. */
export function DesignModal({ designId, onClose }: { designId: string | "new"; onClose: () => void }) {
  const [current, setCurrent] = useState(designId);
  const isNew = current === "new";
  const query = useDesign(isNew ? null : current);
  if (!isNew && !query.data) {
    return (
      <Modal open onClose={onClose} title="Design">
        {query.isError ? <p className="text-sm text-danger-fg">{errorMessage(query.error)}</p> : <Spinner />}
      </Modal>
    );
  }
  return (
    <DesignEditor key={current} design={isNew ? undefined : query.data} onClose={onClose} onCreated={setCurrent} />
  );
}

function DesignEditor({
  design,
  onClose,
  onCreated,
}: {
  design?: Design;
  onClose: () => void;
  onCreated: (id: string) => void;
}) {
  const { can, business } = useWorkspace();
  const toast = useToast();
  const guide = useOnboarding();
  const actions = useDesignActions();
  const canEdit = can("design.manage");
  const [name, setName] = useState(design?.name ?? "");
  const [category, setCategory] = useState(design?.category ?? "");
  const [description, setDescription] = useState(design?.description ?? "");
  const [priceMin, setPriceMin] = useState(design?.priceMin?.toString() ?? "");
  const [priceMax, setPriceMax] = useState(design?.priceMax?.toString() ?? "");
  const [visibility, setVisibility] = useState<DesignVisibility>(design?.visibility ?? "private");
  const [favourite, setFavourite] = useState(design?.isFavourite ?? false);
  const [problem, setProblem] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [pending, setPending] = useState<File[]>([]);
  const input = useRef<HTMLInputElement>(null);
  const mutation = design ? actions.update : actions.createWithPictures;
  const typedMin = parsePrice(priceMin);
  const typedMax = parsePrice(priceMax);
  const pricePreview =
    typedMin === undefined || typedMax === undefined ? null : formatPriceRange(typedMin, typedMax, business.currency);

  const save = () => {
    setProblem(null);
    if (name.trim().length < 2) return setProblem("Name the design.");
    const min = parsePrice(priceMin);
    const max = parsePrice(priceMax);
    if (min === undefined || max === undefined) {
      return setProblem("Enter prices as amounts, like 45000, or leave them empty.");
    }
    if (min !== null && max !== null && min > max) {
      return setProblem("The highest price can't be lower than the lowest price.");
    }
    const body = {
      name: name.trim(),
      category: orNull(category),
      description: orNull(description),
      priceMin: min,
      priceMax: max,
      visibility,
      isFavourite: favourite,
    };
    if (design)
      actions.update.mutate({ id: design.id, input: body }, { onSuccess: () => toast.success("Design saved") });
    else
      actions.createWithPictures.mutate(
        { input: body, files: pending },
        {
          onSuccess: ({ design: created, uploaded, uploadError }) => {
            guide.complete("designs");
            if (!uploadError) {
              toast.success(
                uploaded
                  ? `${created.name} added with ${uploaded} picture${uploaded === 1 ? "" : "s"}`
                  : `${created.name} added`,
              );
              return onClose();
            }
            // The design is saved; keep it open so the missing pictures can be added again.
            toast.error(
              `${created.name} was saved, but ${uploaded ? `only ${uploaded} of ${pending.length}` : "none of the"} pictures uploaded: ${errorMessage(uploadError)}`,
            );
            onCreated(created.id);
          },
        },
      );
  };

  const pick = (list: FileList | null) => {
    const files = Array.from(list ?? []);
    if (input.current) input.current.value = "";
    if (!files.length) return;
    const problem = files.map(pictureProblem).find(Boolean);
    if (problem) return toast.error(problem);
    const room = MAX_PICTURES - (design ? design.images.length : pending.length);
    if (files.length > room) {
      return toast.error(
        room > 0
          ? `A design can have ${MAX_PICTURES} pictures. You can add ${room} more.`
          : `A design can have ${MAX_PICTURES} pictures.`,
      );
    }
    if (design) {
      if (files.length > MAX_PER_UPLOAD) return toast.error(`Add up to ${MAX_PER_UPLOAD} pictures at a time.`);
      actions.addImages.mutate({ id: design.id, files });
    } else {
      setPending([...pending, ...files]);
    }
  };

  return (
    <Modal
      open
      onClose={onClose}
      title={design ? design.name : "New design"}
      size="lg"
      footer={
        canEdit ? (
          <>
            {design && (
              <Button
                variant="ghost"
                className="text-danger-fg sm:mr-auto"
                onClick={() => setDeleting(true)}
                data-cy="design-delete"
              >
                Delete
              </Button>
            )}
            <Button variant="secondary" onClick={onClose} data-cy="design-close">
              {design ? "Close" : "Cancel"}
            </Button>
            <Button onClick={save} loading={mutation.isPending} data-cy="design-save">
              {design
                ? "Save"
                : pending.length
                  ? `Create with ${pending.length} picture${pending.length === 1 ? "" : "s"}`
                  : "Create design"}
            </Button>
          </>
        ) : undefined
      }
    >
      <div className="space-y-4">
        <FormError message={problem ?? (mutation.error ? errorMessage(mutation.error) : null)} />
        <div>
          <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
            {design
              ? design.images.map((img) => (
                  <div key={img.id} className="group relative aspect-[3/4] overflow-hidden rounded-lg bg-subtle">
                    <img src={img.url} alt={img.originalName} className="size-full object-cover" loading="lazy" />
                    {canEdit && (
                      <button
                        type="button"
                        className="absolute top-1 right-1 rounded-md bg-black/60 p-1 text-white focus:opacity-100 sm:opacity-0 sm:group-hover:opacity-100"
                        onClick={() => actions.removeImage.mutate({ id: design.id, imageId: img.id })}
                        aria-label={`Remove ${img.originalName}`}
                        data-cy="design-image-remove"
                      >
                        <Trash2 className="size-4" aria-hidden />
                      </button>
                    )}
                  </div>
                ))
              : pending.map((file, index) => (
                  <PendingThumb
                    key={`${file.name}-${file.size}-${file.lastModified}-${index}`}
                    file={file}
                    onRemove={() => setPending(pending.filter((_, i) => i !== index))}
                    removeCy="design-pending-remove"
                  />
                ))}
            {canEdit && (design ? design.images.length : pending.length) < MAX_PICTURES && (
              <button
                type="button"
                onClick={() => input.current?.click()}
                className="flex aspect-[3/4] flex-col items-center justify-center gap-1 rounded-lg border-2 border-dashed border-line-strong text-sm text-fg-muted hover:bg-subtle"
                disabled={actions.addImages.isPending || mutation.isPending}
                data-cy="design-image-add"
              >
                <ImagePlus className="size-5" aria-hidden />
                {actions.addImages.isPending ? "Uploading…" : "Add pictures"}
              </button>
            )}
          </div>
          {!design && (
            <p className="mt-2 text-xs text-fg-subtle">
              {pending.length
                ? `${pending.length} picture${pending.length === 1 ? "" : "s"} will be added when you create the design.`
                : "Optional. JPG, PNG or WebP, up to 5 MB each."}
            </p>
          )}
          <input
            ref={input}
            type="file"
            accept={TYPES.join(",")}
            multiple
            hidden
            onChange={(e) => pick(e.target.files)}
            data-cy="design-image-input"
          />
        </div>
        <fieldset disabled={!canEdit} className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Name">
              {(p) => <Input {...p} value={name} onChange={(e) => setName(e.target.value)} data-cy="design-name" />}
            </Field>
            <CategoryPicker value={category} onChange={setCategory} />
          </div>
          <Field label="Description (optional)">
            {(p) => (
              <Textarea
                {...p}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                maxLength={2000}
                data-cy="design-description"
              />
            )}
          </Field>
          <div>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label={`Price from (${business.currency})`}>
                {(p) => (
                  <Input
                    {...p}
                    type="number"
                    inputMode="decimal"
                    min={0}
                    step="any"
                    value={priceMin}
                    onChange={(e) => setPriceMin(e.target.value)}
                    data-cy="design-price-min"
                  />
                )}
              </Field>
              <Field label={`Up to (${business.currency})`}>
                {(p) => (
                  <Input
                    {...p}
                    type="number"
                    inputMode="decimal"
                    min={0}
                    step="any"
                    value={priceMax}
                    onChange={(e) => setPriceMax(e.target.value)}
                    data-cy="design-price-max"
                  />
                )}
              </Field>
            </div>
            <p className="mt-1.5 text-xs text-fg-subtle" data-cy="design-price-preview">
              {pricePreview
                ? `Customers will see: ${pricePreview}`
                : "Optional. Customers see “Ask for price” if you leave both empty. Fill one box for “From …” or “Up to …”."}
            </p>
          </div>
          <Toggle
            label="Show to customers"
            description="Appears on your public page (once it's published) and on customers' private pages. A design needs a picture to be listed."
            checked={visibility === "customers"}
            onChange={(on) => setVisibility(on ? "customers" : "private")}
            disabled={!canEdit}
            data-cy="design-visibility"
          />
          <button
            type="button"
            onClick={() => setFavourite(!favourite)}
            aria-pressed={favourite}
            className={cn("inline-flex items-center gap-2 text-sm", favourite ? "text-warning-fg" : "text-fg-muted")}
            data-cy="design-favourite"
          >
            <Star className={cn("size-4", favourite && "fill-current")} aria-hidden />{" "}
            {favourite ? "Favourite" : "Mark as favourite"}
          </button>
        </fieldset>
      </div>
      <ConfirmDialog
        open={deleting}
        onClose={() => setDeleting(false)}
        onConfirm={() => design && actions.remove.mutate(design.id, { onSuccess: onClose })}
        title="Delete this design?"
        message="Its pictures are deleted too. Orders that used it aren't affected."
        confirmLabel="Delete"
        danger
        loading={actions.remove.isPending}
      />
    </Modal>
  );
}
