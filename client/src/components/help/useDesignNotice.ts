import { Camera, EyeOff, Globe } from "lucide-react";
import { useDesignVisibility } from "../../hooks/useDesignVisibility";
import { useNotNow } from "../../hooks/useNotNow";
import type { Notice } from "./HelpNotice";

/** Why people can't see the saved designs, the easiest to fix first. Nothing when everything is showing. */
export function useDesignNotice({ onShow, onAddPhoto }: { onShow: () => void; onAddPhoto: (id: string) => void }): {
  ready: boolean;
  notice: Notice | null;
} {
  const status = useDesignVisibility();
  const { kept } = useNotNow();
  if (!status.ready) return { ready: !status.enabled || status.failed, notice: null };

  const hidden = status.hidden.filter((d) => !kept.has(d.id));
  const noPhoto = status.noPhoto.filter((d) => !kept.has(`photo:${d.id}`));

  let notice: Notice | null = null;
  if (hidden.length) {
    notice = {
      icon: EyeOff,
      title:
        hidden.length === 1
          ? `People can't see “${hidden[0].name}” yet`
          : `People can't see ${hidden.length} of your designs yet`,
      message: "You saved them, but they are switched off. We can switch them on for you.",
      action: { label: hidden.length === 1 ? "Show it to people" : "Show them to people", run: onShow },
      later: hidden.map((d) => d.id),
    };
  } else if (!status.pageOn && status.shown.length && !kept.has("page")) {
    notice = {
      icon: Globe,
      title: "Your public page is switched off",
      message: status.canPublish
        ? "Your designs are ready, but the public can't see them. We can switch the page on for you."
        : "Your designs are ready. Ask the business owner to switch on the page so the public can see them.",
      action: status.canPublish ? { label: "Switch on my page", run: onShow } : undefined,
      later: ["page"],
    };
  } else if (noPhoto.length) {
    notice = {
      icon: Camera,
      title: noPhoto.length === 1 ? `“${noPhoto[0].name}” needs a photo` : `${noPhoto.length} designs need a photo`,
      message: "People can't see a design without a picture.",
      action: { label: "Add a photo", run: () => onAddPhoto(noPhoto[0].id) },
      later: noPhoto.map((d) => `photo:${d.id}`),
    };
  }
  return { ready: true, notice };
}
