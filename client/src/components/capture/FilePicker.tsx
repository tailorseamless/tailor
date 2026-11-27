import { Camera, FileText, Upload, X } from "lucide-react";
import { useEffect, useMemo, useRef } from "react";
import { isPhoto, RECORD_ACCEPT } from "../../utils/recordFiles";
import { Button } from "../shared/Button";

interface Props {
  files: File[];
  onAdd: (files: File[]) => void;
  onRemove: (index: number) => void;
  max: number;
  disabled?: boolean;
}

/** Take photos with the camera, or upload photos and files from the phone or computer, with previews. */
export function FilePicker({ files, onAdd, onRemove, max, disabled }: Props) {
  const camera = useRef<HTMLInputElement>(null);
  const chooser = useRef<HTMLInputElement>(null);
  const previews = useMemo(() => files.map((file) => (isPhoto(file) ? URL.createObjectURL(file) : null)), [files]);
  useEffect(() => () => previews.forEach((url) => url && URL.revokeObjectURL(url)), [previews]);
  const full = files.length >= max;

  const take = (input: HTMLInputElement) => {
    if (!input.files) return;
    onAdd(Array.from(input.files));
    input.value = ""; // the same file can be chosen again after removing it
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
          icon={<Upload className="size-4" aria-hidden />}
          onClick={() => chooser.current?.click()}
          disabled={disabled || full}
          data-cy="capture-choose"
        >
          Upload photos or a file
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
          ref={chooser}
          type="file"
          accept={RECORD_ACCEPT}
          multiple
          className="hidden"
          onChange={(e) => take(e.currentTarget)}
          aria-hidden
          tabIndex={-1}
          data-cy="capture-input"
        />
      </div>
      {files.length > 0 && (
        <ul className="flex flex-wrap gap-3" aria-label="Chosen files">
          {files.map((file, i) => (
            <li key={`${file.name}-${file.size}-${i}`} className="relative">
              {previews[i] ? (
                <img
                  src={previews[i]}
                  alt={`Record page ${i + 1}`}
                  className="h-32 w-24 rounded-lg border border-line object-cover"
                />
              ) : (
                <div className="flex h-32 w-24 flex-col items-center justify-center gap-2 rounded-lg border border-line bg-subtle p-2 text-center">
                  <FileText className="size-8 text-fg-muted" aria-hidden />
                  <span className="line-clamp-3 text-xs break-all text-fg-muted">{file.name}</span>
                </div>
              )}
              {!disabled && (
                <button
                  type="button"
                  onClick={() => onRemove(i)}
                  className="absolute -top-2 -right-2 rounded-full bg-surface p-1 shadow ring-1 ring-line"
                  aria-label={`Remove ${file.name}`}
                >
                  <X className="size-4" aria-hidden />
                </button>
              )}
            </li>
          ))}
        </ul>
      )}
      <p className="text-xs text-fg-subtle">
        {full
          ? `That's the most for one go (${max}).`
          : `Up to ${max} at a time: photos, PDF, Excel, Word, CSV or text.`}{" "}
        For photos, one page each, flat, in good light, with all the writing in view.
      </p>
    </div>
  );
}
