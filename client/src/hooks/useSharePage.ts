import { useCallback } from "react";
import { useToast } from "../contexts/ToastContext";

/**
 * Share a link the way the device prefers: the phone's own share sheet when it has one (WhatsApp, Messages…),
 * otherwise copy it. `copy` always copies.
 */
export function useSharePage() {
  const toast = useToast();

  const copy = useCallback(
    (url: string) =>
      navigator.clipboard.writeText(url).then(
        () => toast.success("Link copied"),
        () => toast.error("Couldn't copy the link"),
      ),
    [toast],
  );

  const share = useCallback(
    async (url: string, title: string) => {
      if (typeof navigator.share === "function") {
        try {
          await navigator.share({ title, text: title, url });
          return;
        } catch (err) {
          // Closing the share sheet is a choice, not a failure.
          if (err instanceof DOMException && err.name === "AbortError") return;
        }
      }
      await copy(url);
    },
    [copy],
  );

  return { share, copy };
}
