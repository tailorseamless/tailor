import { ImagePlus, Star, Trash2 } from "lucide-react";
import { useRef, useState } from "react";
import { useToast } from "../../contexts/ToastContext";
import { useDesign, useDesignActions, useDesignCategories } from "../../hooks/useTeam";
import { useWorkspace } from "../../hooks/useWorkspace";
import type { Design, DesignVisibility } from "../../types/workspace.types";
import { cn } from "../../utils/cn";
import { errorMessage } from "../../utils/errors";
import { orNull } from "../../utils/validation";
import { Button } from "../shared/Button";
import { Field, FormError, Input, Textarea, Toggle } from "../shared/Field";
import { ConfirmDialog, Modal } from "../shared/Modal";
import { Spinner } from "../shared/States";

const TYPES = ["image/jpeg", "image/png", "image/webp"];
const MAX_BYTES = 5 * 1024 * 1024;

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
  const { can } = useWorkspace();
  const toast = useToast();
  const actions = useDesignActions();
  const categories = useDesignCategories();
  const canEdit = can("design.manage");
  const [name, setName] = useState(design?.name ?? "");
  const [category, setCategory] = useState(design?.category ?? "");
  const [description, setDescription] = useState(design?.description ?? "");
  const [visibility, setVisibility] = useState<DesignVisibility>(design?.visibility ?? "private");
  const [favourite, setFavourite] = useState(design?.isFavourite ?? false);
  const [problem, setProblem] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);
  const input = useRef<HTMLInputElement>(null);
  const mutation = design ? actions.update : actions.create;

  const save = () => {
    setProblem(null);
    if (name.trim().length < 2) return setProblem("Name the design.");
    const body = {
      name: name.trim(),
      category: orNull(category),
      description: orNull(description),
      visibility,
      isFavourite: favourite,
    };
    if (design)
      actions.update.mutate({ id: design.id, input: body }, { onSuccess: () => toast.success("Design saved") });
    // A new design stays open so pictures can be added straight away.
    else actions.create.mutate(body, { onSuccess: (created) => onCreated(created.id) });
  };

  const pick = (list: FileList | null) => {
    const files = Array.from(list ?? []);
    if (input.current) input.current.value = "";
    if (!design || !files.length) return;
    const bad = files.find((f) => !TYPES.includes(f.type) || f.size > MAX_BYTES);
    if (bad) return toast.error(`${bad.name} isn't a JPG, PNG or WebP photo under 5 MB.`);
    if (files.length > 5) return toast.error("Add up to 5 pictures at a time.");
    actions.addImages.mutate({ id: design.id, files });
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
              {design ? "Save" : "Create, then add pictures"}
            </Button>
          </>
        ) : undefined
      }
    >
      <div className="space-y-4">
        <FormError message={problem ?? (mutation.error ? errorMessage(mutation.error) : null)} />
        {design && (
          <div>
            <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
              {design.images.map((img) => (
                <div key={img.id} className="group relative aspect-[3/4] overflow-hidden rounded-lg bg-subtle">
                  <img src={img.url} alt={img.originalName} className="size-full object-cover" loading="lazy" />
                  {canEdit && (
                    <button
                      type="button"
                      className="absolute top-1 right-1 rounded-md bg-black/60 p-1 text-white sm:opacity-0 sm:group-hover:opacity-100 focus:opacity-100"
                      onClick={() => actions.removeImage.mutate({ id: design.id, imageId: img.id })}
                      aria-label={`Remove ${img.originalName}`}
                      data-cy="design-image-remove"
                    >
                      <Trash2 className="size-4" aria-hidden />
                    </button>
                  )}
                </div>
              ))}
              {canEdit && (
                <button
                  type="button"
                  onClick={() => input.current?.click()}
                  className="flex aspect-[3/4] flex-col items-center justify-center gap-1 rounded-lg border-2 border-dashed border-line-strong text-sm text-fg-muted hover:bg-subtle"
                  disabled={actions.addImages.isPending}
                  data-cy="design-image-add"
                >
                  <ImagePlus className="size-5" aria-hidden />
                  {actions.addImages.isPending ? "Uploading…" : "Add pictures"}
                </button>
              )}
            </div>
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
        )}
        <fieldset disabled={!canEdit} className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Name">
              {(p) => <Input {...p} value={name} onChange={(e) => setName(e.target.value)} data-cy="design-name" />}
            </Field>
            <Field label="Category (optional)" hint="e.g. Agbada, Bridal, Kaftan">
              {(p) => (
                <>
                  <Input
                    {...p}
                    list="design-categories"
                    value={category}
                    onChange={(e) => setCategory(e.target.value)}
                    data-cy="design-category"
                  />
                  <datalist id="design-categories">
                    {(categories.data ?? []).map((c) => (
                      <option key={c} value={c} />
                    ))}
                  </datalist>
                </>
              )}
            </Field>
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
          <Toggle
            label="Show to customers"
            description="Appears on your booking page and customers' private pages."
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
