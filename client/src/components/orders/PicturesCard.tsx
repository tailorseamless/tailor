import { ImagePlus, Trash2 } from "lucide-react";
import { useRef, useState } from "react";
import { useToast } from "../../contexts/ToastContext";
import { useOrderImages } from "../../hooks/useOrders";
import { useWorkspace } from "../../hooks/useWorkspace";
import type { OrderImage } from "../../types/order.types";
import { Button } from "../shared/Button";
import { Card } from "../shared/Display";
import { ConfirmDialog } from "../shared/Modal";

const MAX_PER_ORDER = 12;
const MAX_PER_UPLOAD = 5;
const MAX_BYTES = 5 * 1024 * 1024;
const TYPES = ["image/jpeg", "image/png", "image/webp"];

/** Reference pictures: styles, fabric, the finished garment. */
export function PicturesCard({ orderId, images }: { orderId: string; images: OrderImage[] }) {
  const { can } = useWorkspace();
  const toast = useToast();
  const { upload, remove } = useOrderImages(orderId);
  const input = useRef<HTMLInputElement>(null);
  const [deleting, setDeleting] = useState<OrderImage | null>(null);
  const canEdit = can("order.update");
  const room = MAX_PER_ORDER - images.length;

  const pick = (list: FileList | null) => {
    const files = Array.from(list ?? []);
    if (input.current) input.current.value = "";
    if (!files.length) return;
    const bad = files.find((f) => !TYPES.includes(f.type) || f.size > MAX_BYTES);
    if (bad) return toast.error(`${bad.name} isn't a JPG, PNG or WebP photo under 5 MB.`);
    if (files.length > Math.min(room, MAX_PER_UPLOAD)) {
      return toast.error(
        room < MAX_PER_UPLOAD
          ? `You can add ${room} more picture${room === 1 ? "" : "s"}.`
          : `Add up to ${MAX_PER_UPLOAD} at a time.`,
      );
    }
    upload.mutate(files);
  };

  return (
    <Card
      title="Pictures"
      action={
        canEdit &&
        room > 0 && (
          <>
            <input
              ref={input}
              type="file"
              accept={TYPES.join(",")}
              multiple
              hidden
              onChange={(e) => pick(e.target.files)}
              data-cy="pictures-input"
            />
            <Button
              size="sm"
              variant="secondary"
              icon={<ImagePlus className="size-4" aria-hidden />}
              loading={upload.isPending}
              onClick={() => input.current?.click()}
              data-cy="pictures-add"
            >
              Add
            </Button>
          </>
        )
      }
    >
      {images.length ? (
        <ul className="grid grid-cols-3 gap-2 p-3 sm:grid-cols-4">
          {images.map((img) => (
            <li key={img.id} className="group relative aspect-square overflow-hidden rounded-lg bg-subtle">
              <a href={img.url} target="_blank" rel="noreferrer" data-cy="picture-open">
                <img src={img.url} alt={img.originalName} loading="lazy" className="size-full object-cover" />
              </a>
              {canEdit && (
                <button
                  type="button"
                  onClick={() => setDeleting(img)}
                  className="absolute top-1 right-1 rounded-md bg-black/60 p-1 text-white opacity-100 sm:opacity-0 sm:group-hover:opacity-100 focus:opacity-100"
                  aria-label={`Remove ${img.originalName}`}
                  data-cy="picture-remove"
                >
                  <Trash2 className="size-4" aria-hidden />
                </button>
              )}
            </li>
          ))}
        </ul>
      ) : (
        <p className="px-4 py-6 text-center text-sm text-fg-subtle">Add style references or fabric photos.</p>
      )}
      <ConfirmDialog
        open={deleting !== null}
        onClose={() => setDeleting(null)}
        onConfirm={() => deleting && remove.mutate(deleting.id, { onSuccess: () => setDeleting(null) })}
        title="Remove this picture?"
        message="It's deleted for good."
        confirmLabel="Remove"
        danger
        loading={remove.isPending}
      />
    </Card>
  );
}
