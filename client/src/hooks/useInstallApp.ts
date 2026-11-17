import { useSyncExternalStore } from "react";
import { installPrompt } from "../lib/pwa";

/** Whether the browser offers "install TailorFlow", and a function to show that prompt. */
export function useInstallApp() {
  const available = useSyncExternalStore(installPrompt.subscribe, installPrompt.available, () => false);
  return { available, installed: installPrompt.installed(), install: installPrompt.show };
}
