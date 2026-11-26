import { useMemo } from "react";
import { useDesigns } from "./useTeam";
import { useWorkspace } from "./useWorkspace";

/**
 * What stands between the saved designs and the people meant to see them. A design is seen only when it is shown
 * to customers, has a photo, and (for the public) the page is published.
 */
export function useDesignVisibility() {
  const { can, business } = useWorkspace();
  const enabled = can("design.manage");
  const privateQuery = useDesigns({ visibility: "private", limit: 100 }, enabled);
  const shownQuery = useDesigns({ visibility: "customers", limit: 100 }, enabled);

  return useMemo(() => {
    const hiddenAll = privateQuery.data?.data ?? [];
    const shownAll = shownQuery.data?.data ?? [];
    return {
      enabled,
      failed: privateQuery.isError || shownQuery.isError,
      ready: enabled && Boolean(privateQuery.data && shownQuery.data),
      /** Switched off, but with a photo: one tap away from being seen. */
      hidden: hiddenAll.filter((d) => d.images.length > 0),
      /** Switched on and with a photo. */
      shown: shownAll.filter((d) => d.images.length > 0),
      /** Nobody can see these until someone adds a picture. */
      noPhoto: [...shownAll, ...hiddenAll].filter((d) => d.images.length === 0),
      pageOn: business.pageEnabled,
      /** Only the owner can publish the page. */
      canPublish: can("business.update"),
    };
  }, [
    enabled,
    privateQuery.data,
    privateQuery.isError,
    shownQuery.data,
    shownQuery.isError,
    business.pageEnabled,
    can,
  ]);
}
