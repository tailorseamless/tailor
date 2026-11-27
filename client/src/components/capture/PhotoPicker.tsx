import { Camera, ImagePlus, X } from "lucide-react";
import { useEffect, useMemo, useRef } from "react";
import { Button } from "../shared/Button";

interface Props {
  photos: File[];
  onAdd: (files: File[]) => void;
  onRemove: (index: number) => void;
  max: number;
  disabled?: boolean;
}

/** Take photos with the camera or choose them from the phone, with previews. */
export function PhotoPicker({ photos, onAdd, onRemove, max, disabled }: Props) {
  const camera = useRef<HTMLInputElement>(null);
  const gallery = useRef<HTMLInputElement>(null);
  const previews = useMemo(() => photos.map((photo) => URL.createObjectURL(photo)), [photos]);
  useEffect(() => () => previews.forEach((url) => URL.revokeObjectURL(url)), [previews]);
  const full = photos.length >= max;

  const take = (input: HTMLInputElement | null) => {
    if (!input?.files) return;
    onAdd(Array.from(input.files));
    input.value = ""; // the same photo can be chosen again after removing it
  };

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2">
        <Button
          icon={<Camera className="size-4" aria-hidden />}
          onClick={() => camera.current?.click()}
          disabled={disabled || full}
          data-cy="capture-camera"
        >
          Take a photo
        </Button>
        <Button
          variant="secondary"
          icon={<ImagePlus className="size-4" aria-hidden />}
          onClick={() => gallery.current?.click()}
          disabled={disabled || full}
          data-cy="capture-choose"
        >
          Choose photos
        </Button>
        <input
          ref={camera}
          type="file"
          accept="image/*"
          capture="environment"
          className="hidden"
          onChange={(e) => take(e.currentTarget)}
          aria-hidden
          tabIndex={-1}
        />
        <input
          ref={gallery}
          type="file"
          accept="image/*"
          multiple
          className="hidden"
          onChange={(e) => take(e.currentTarget)}
          aria-hidden
          tabIndex={-1}
          data-cy="capture-input"
        />
      </div>
      {photos.length > 0 && (
        <ul className="flex flex-wrap gap-3" aria-label="Chosen photos">
          {previews.map((url, i) => (
            <li key={url} className="relative">
              <img
                src={url}
                alt={`Record page ${i + 1}`}
                className="h-32 w-24 rounded-lg border border-line object-cover"
              />
              {!disabled && (
                <button
                  type="button"
                  onClick={() => onRemove(i)}
                  className="absolute -top-2 -right-2 rounded-full bg-surface p-1 shadow ring-1 ring-line"
                  aria-label={`Remove photo ${i + 1}`}
                >
                  <X className="size-4" aria-hidden />
                </button>
              )}
            </li>
          ))}
        </ul>
      )}
      <p className="text-xs text-fg-subtle">
        {full ? `That's the most for one go (${max}).` : `Up to ${max} photos at a time.`} One page per photo, flat, in
        good light, with all the writing in view.
      </p>
    </div>
  );
}
