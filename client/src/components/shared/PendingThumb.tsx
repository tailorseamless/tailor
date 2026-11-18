import { Trash2 } from "lucide-react";
import { useEffect, useState } from "react";
import { cn } from "../../utils/cn";

/** A picture chosen for something that isn't saved yet, shown from the file itself. */
export function PendingThumb({
  file,
  onRemove,
  className,
  removeCy = "pending-remove",
}: {
  file: File;
  onRemove: () => void;
  className?: string;
  removeCy?: string;
}) {
  const [url, setUrl] = useState<string>();
  useEffect(() => {
    const made = URL.createObjectURL(file);
    setUrl(made);
    return () => URL.revokeObjectURL(made);
  }, [file]);
  return (
    <div className={cn("group relative aspect-3/4 overflow-hidden rounded-lg bg-subtle", className)}>
      {url && <img src={url} alt={file.name} className="size-full object-cover" />}
      <button
        type="button"
        className="absolute top-1 right-1 rounded-md bg-black/60 p-1 text-white focus:opacity-100 sm:opacity-0 sm:group-hover:opacity-100"
        onClick={onRemove}
        aria-label={`Don't add ${file.name}`}
        data-cy={removeCy}
      >
        <Trash2 className="size-4" aria-hidden />
      </button>
    </div>
  );
}
