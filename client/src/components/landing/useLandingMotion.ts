import { useCallback, useEffect, useRef, useState, useSyncExternalStore, type PointerEvent } from "react";

const REDUCED = "(prefers-reduced-motion: reduce)";

function subscribeReduced(onChange: () => void) {
  const query = window.matchMedia(REDUCED);
  query.addEventListener("change", onChange);
  return () => query.removeEventListener("change", onChange);
}

/** True when the person asked their device for less motion. Every moving part of the landing page checks it. */
export function useReducedMotion(): boolean {
  return useSyncExternalStore(
    subscribeReduced,
    () => window.matchMedia(REDUCED).matches,
    () => false,
  );
}

/** Becomes true the first time the element scrolls into view (and, with `once: false`, false again when it leaves). */
export function useInView<T extends Element>({ once = true, rootMargin = "0px 0px -12% 0px", threshold = 0.15 } = {}) {
  const ref = useRef<T>(null);
  const [inView, setInView] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (typeof IntersectionObserver === "undefined") {
      setInView(true);
      return;
    }
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setInView(true);
          if (once) observer.disconnect();
        } else if (!once) {
          setInView(false);
        }
      },
      { rootMargin, threshold },
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [once, rootMargin, threshold]);

  return [ref, inView] as const;
}

/**
 * Steps through 0…count-1 every `intervalMs` while `running`.
 * Once the person picks a step themselves it stops for good — we never take the controls back.
 */
export function useAutoCycle(count: number, intervalMs: number, running: boolean) {
  const [index, setIndex] = useState(0);
  const [chosen, setChosen] = useState(false);

  useEffect(() => {
    if (!running || chosen) return;
    const id = window.setInterval(() => setIndex((i) => (i + 1) % count), intervalMs);
    return () => window.clearInterval(id);
  }, [running, chosen, count, intervalMs]);

  const select = useCallback((i: number) => {
    setChosen(true);
    setIndex(i);
  }, []);

  return { index, select };
}

/** True once the page has scrolled past `offset` pixels. */
export function useScrolled(offset = 24): boolean {
  const [scrolled, setScrolled] = useState(false);
  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > offset);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, [offset]);
  return scrolled;
}

/** Writes the pointer position into --mx / --my on the hovered element, for the card spotlight. Style only, no re-render. */
export function trackPointer(e: PointerEvent<HTMLElement>) {
  const el = e.currentTarget;
  const box = el.getBoundingClientRect();
  el.style.setProperty("--mx", `${e.clientX - box.left}px`);
  el.style.setProperty("--my", `${e.clientY - box.top}px`);
}
