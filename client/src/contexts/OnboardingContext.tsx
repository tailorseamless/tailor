import { createContext, useCallback, useContext, useMemo, useRef, useState, type ReactNode } from "react";
import { useNavigate } from "react-router-dom";
import { GUIDE_STEPS, type GuideStep } from "../components/onboarding/guideSteps";
import { useSaveOnboarding } from "../hooks/useAccount";
import { useWorkspace } from "../hooks/useWorkspace";
import type { OnboardingState, OnboardingStep } from "../types/auth.types";

const COLLAPSED_KEY = "ts-guide-collapsed";

function readCollapsed(): boolean {
  try {
    return localStorage.getItem(COLLAPSED_KEY) === "1";
  } catch {
    return false;
  }
}

function writeCollapsed(collapsed: boolean): void {
  try {
    if (collapsed) localStorage.setItem(COLLAPSED_KEY, "1");
    else localStorage.removeItem(COLLAPSED_KEY);
  } catch {
    // Private mode or blocked storage: the guide just opens expanded next time.
  }
}

interface OnboardingApi {
  /** The steps this person can do, in order. */
  steps: GuideStep[];
  completed: Set<OnboardingStep>;
  /** The floating guide is showing (expanded or collapsed). */
  active: boolean;
  collapsed: boolean;
  /** The step the guide is on: the one they picked, else the first one not done. Null when all are done. */
  current: GuideStep | null;
  /** The step that was just finished, for a moment of "done". */
  justCompleted: GuideStep | null;
  /** Marks a step done. Call it when the person does the thing; a no-op when the guide was never started. */
  complete: (step: OnboardingStep) => void;
  /** Opens the guide on a step (from Settings) and goes to its page. */
  open: (step: OnboardingStep) => void;
  /** Clears progress and starts again from the first step. */
  restart: () => void;
  /** Closes the guide; Settings can bring it back. */
  dismiss: () => void;
  setCollapsed: (collapsed: boolean) => void;
}

const OnboardingContext = createContext<OnboardingApi | null>(null);

/**
 * The getting-started guide: templates → a customer → a practice order → a design.
 * Progress is saved on the account, so it carries across devices.
 */
export function OnboardingProvider({ children }: { children: ReactNode }) {
  const { me, can } = useWorkspace();
  const navigate = useNavigate();
  // `mutate` is stable across renders, unlike the mutation object around it.
  const { mutate: saveOnboarding } = useSaveOnboarding();
  // `me` is only re-read on sign-in, so after the first render the local copy is the newest.
  const [state, setState] = useState<OnboardingState | null>(me.user.onboarding);
  const stateRef = useRef(state);
  const [focus, setFocus] = useState<OnboardingStep | null>(null);
  const [justCompleted, setJustCompleted] = useState<GuideStep | null>(null);
  const [collapsed, setCollapsedState] = useState(readCollapsed);

  const steps = useMemo(() => GUIDE_STEPS.filter((s) => can(s.permission)), [can]);
  const completed = useMemo(() => new Set(state?.completed ?? []), [state]);

  const apply = useCallback(
    (next: OnboardingState) => {
      stateRef.current = next;
      setState(next);
      saveOnboarding(next);
    },
    [saveOnboarding],
  );

  const setCollapsed = useCallback((next: boolean) => {
    setCollapsedState(next);
    writeCollapsed(next);
  }, []);

  const complete = useCallback(
    (step: OnboardingStep) => {
      const prev = stateRef.current;
      if (!prev) return;
      // Re-opened from Settings and done again (or "Next" on a step already done): move on to what's left.
      setFocus((f) => (f === step ? null : f));
      if (prev.completed.includes(step)) return;
      apply({ ...prev, completed: [...prev.completed, step] });
      setJustCompleted(GUIDE_STEPS.find((s) => s.id === step) ?? null);
    },
    [apply],
  );

  const open = useCallback(
    (step: OnboardingStep) => {
      const prev = stateRef.current;
      apply({ completed: prev?.completed ?? [], dismissed: false });
      setFocus(step);
      setJustCompleted(null);
      setCollapsed(false);
      const target = GUIDE_STEPS.find((s) => s.id === step);
      if (target) navigate(target.start ?? target.path);
    },
    [apply, navigate, setCollapsed],
  );

  const restart = useCallback(() => {
    apply({ completed: [], dismissed: false });
    setFocus(null);
    setJustCompleted(null);
    setCollapsed(false);
    if (steps[0]) navigate(steps[0].path);
  }, [apply, navigate, setCollapsed, steps]);

  const dismiss = useCallback(() => {
    const prev = stateRef.current;
    apply({ completed: prev?.completed ?? [], dismissed: true });
    setFocus(null);
    setJustCompleted(null);
  }, [apply]);

  const value = useMemo<OnboardingApi>(() => {
    const picked = focus ? steps.find((s) => s.id === focus) : undefined;
    const current = picked ?? steps.find((s) => !completed.has(s.id)) ?? null;
    return {
      steps,
      completed,
      active: Boolean(state && !state.dismissed && steps.length > 0),
      collapsed,
      current,
      justCompleted,
      complete,
      open,
      restart,
      dismiss,
      setCollapsed,
    };
  }, [steps, completed, state, collapsed, focus, justCompleted, complete, open, restart, dismiss, setCollapsed]);

  return <OnboardingContext.Provider value={value}>{children}</OnboardingContext.Provider>;
}

const noop = () => undefined;
const outside: OnboardingApi = {
  steps: [],
  completed: new Set(),
  active: false,
  collapsed: false,
  current: null,
  justCompleted: null,
  complete: noop,
  open: noop,
  restart: noop,
  dismiss: noop,
  setCollapsed: noop,
};

/** Safe anywhere: outside the signed-in app it does nothing. */
export function useOnboarding(): OnboardingApi {
  return useContext(OnboardingContext) ?? outside;
}
