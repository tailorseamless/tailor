import { useEffect, useState } from "react";
import { notificationEndpoints } from "../endpoints/misc.endpoints";
import { pushClient } from "../lib/push";
import { keys } from "./queryKeys";
import { useApiMutation } from "./useApi";

/** Push notifications on this device: can it, is it on, and switches to change that. */
export function usePush() {
  const [supported, setSupported] = useState<boolean | null>(null);
  const [token, setToken] = useState<string | null>(pushClient.token());
  const [permission, setPermission] = useState(pushClient.permission());

  useEffect(() => {
    let live = true;
    pushClient.supported().then(
      (ok) => live && setSupported(ok),
      () => live && setSupported(false),
    );
    return () => {
      live = false;
    };
  }, []);

  const enable = useApiMutation(
    async () => {
      const next = await pushClient.enable();
      setPermission(pushClient.permission());
      if (!next) throw new Error("Notifications are blocked. Allow them for this site in your browser settings.");
      await notificationEndpoints.registerDevice(next);
      setToken(next);
      return next;
    },
    { invalidate: [keys.notifications.preferences], success: "This device will get notifications" },
  );

  const disable = useApiMutation(
    async () => {
      const old = await pushClient.disable();
      setToken(null);
      if (old) await notificationEndpoints.removeDevice(old);
    },
    { invalidate: [keys.notifications.preferences], success: "Notifications turned off on this device" },
  );

  return {
    supported,
    enabled: Boolean(token) && permission === "granted",
    blocked: permission === "denied",
    enable,
    disable,
  };
}
