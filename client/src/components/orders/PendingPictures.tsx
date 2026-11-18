import { ImagePlus } from "lucide-react";
import { useRef } from "react";
import { useToast } from "../../contexts/ToastContext";
import { PICTURE_TYPES, PICTURES_PER_ITEM, pictureProblem } from "../../utils/pictures";
import { Button } from "../shared/Button";
import { Card } from "../shared/Display";
import { PendingThumb } from "../shared/PendingThumb";

/**
 * Pictures of the styles or fabric the customer wants, chosen while the order is typed. They are only held here:
 * they go up with the order when it is created, and appear on the order's Pictures card afterwards.
 */
export function PendingPictures({
  files,
  onChange,
  disabled,
}: {
  files: File[];
  onChange: (files: File[]) => void;
  disabled?: boolean;
}) {
  const toast = useToast();
  const input = useRef<HTMLInputElement>(null);
  const room = PICTURES_PER_ITEM - files.length;

  const pick = (list: FileList | null) => {
    const picked = Array.from(list ?? []);
    if (input.current) input.current.value = ""; // so choosing the same photo again still fires
    if (!picked.length) return;
    const problem = picked.map(pictureProblem).find(Boolean);
    if (problem) return toast.error(problem);
    if (picked.length > room) {
      return toast.error(
        room > 0
          ? `An order can have ${PICTURES_PER_ITEM} pictures. You can add ${room} more.`
          : `An order can have ${PICTURES_PER_ITEM} pictures.`,
      );
    }
    onChange([...files, ...picked]);
  };

  return (
    <Card
      title="Pictures (optional)"
      action={
        room > 0 && (
          <>
            <input
              ref={input}
              type="file"
              accept={PICTURE_TYPES.join(",")}
              multiple
              hidden
              onChange={(e) => pick(e.target.files)}
              data-cy="order-pictures-input"
            />
            <Button
              size="sm"
              variant="secondary"
              icon={<ImagePlus className="size-4" aria-hidden />}
              disabled={disabled}
              onClick={() => input.current?.click()}
              data-cy="order-pictures-add"
            >
              Add
            </Button>
          </>
        )
      }
    >
      {files.length ? (
        <ul className="grid grid-cols-3 gap-2 p-3 sm:grid-cols-4" data-cy="order-pictures">
          {files.map((file, index) => (
            <li key={`${file.name}-${file.size}-${file.lastModified}-${index}`}>
              <PendingThumb
                file={file}
                className="aspect-square"
                onRemove={() => onChange(files.filter((_, i) => i !== index))}
                removeCy="order-picture-remove"
              />
            </li>
          ))}
        </ul>
      ) : (
        <p className="px-4 py-6 text-center text-sm text-fg-subtle">
          Add the styles or fabric the customer wants. JPG, PNG or WebP, up to 5 MB each.
        </p>
      )}
      {files.length > 0 && (
        <p className="border-t border-line px-4 py-2 text-xs text-fg-subtle">
          {files.length} picture{files.length === 1 ? "" : "s"} will be saved with the order.
        </p>
      )}
    </Card>
  );
}
