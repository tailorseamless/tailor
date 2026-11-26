import { useCallback, useMemo, useSyncExternalStore } from "react";
import { useWorkspace } from "./useWorkspace";

/**
 * "Not now" answers to the app's offers of help, so it doesn't ask again. Kept on this device only. An entry is a
 * design id (meant to stay private), `photo:<id>`, or one of `page`, `bank`, `booking`, `measure`.
 */
const listeners = new Set<() => void>();
const memory = new Map<string, string>();

function read(key: string): string {
  try {
    return localStorage.getItem(key) ?? memory.get(key) ?? "[]";
  } catch {
    return memory.get(key) ?? "[]";
  }
}

function write(key: string, value: string): void {
  memory.set(key, value);
  try {
    localStorage.setItem(key, value);
  } catch {
    // Private mode or blocked storage: remembered until the app is closed.
  }
  listeners.forEach((listener) => listener());
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function parse(raw: string): string[] {
  try {
    const value: unknown = JSON.parse(raw);
    return Array.isArray(value) ? value.filter((v): v is string => typeof v === "string") : [];
  } catch {
    return [];
  }
}

export function useNotNow() {
  const { business } = useWorkspace();
  const key = `ts-not-now:${business.id}`;
  const raw = useSyncExternalStore(subscribe, () => read(key));
  const kept = useMemo(() => new Set(parse(raw)), [raw]);

  const keep = useCallback(
    (entries: string[]) => write(key, JSON.stringify([...new Set([...parse(read(key)), ...entries])])),
    [key],
  );
  const forget = useCallback(
    (entries: string[]) => write(key, JSON.stringify(parse(read(key)).filter((e) => !entries.includes(e)))),
    [key],
  );

  return { kept, keep, forget };
}
