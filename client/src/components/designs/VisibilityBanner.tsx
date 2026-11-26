import { HelpNotice } from "../help/HelpNotice";
import { useDesignNotice } from "../help/useDesignNotice";

/** On the Designs page: says why people can't see the saved designs, and offers to fix it. */
export function VisibilityBanner({ onShow, onAddPhoto }: { onShow: () => void; onAddPhoto: (id: string) => void }) {
  const { notice } = useDesignNotice({ onShow, onAddPhoto });
  return notice && <HelpNotice notice={notice} />;
}
