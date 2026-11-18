import { useQueryClient } from "@tanstack/react-query";
import type { User } from "firebase/auth";
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { authEndpoints } from "../endpoints/auth.endpoints";
import { notificationEndpoints } from "../endpoints/misc.endpoints";
import { authClient } from "../lib/firebase";
import { pushClient } from "../lib/push";
import { ApiError } from "../transport/http";
import type { Me, Permission } from "../types/auth.types";
import { errorMessage } from "../utils/errors";

export type AuthStatus = "loading" | "unconfigured" | "signedOut" | "unverified" | "notLinked" | "ready" | "error";

interface AuthApi {
  status: AuthStatus;
  user: User | null;
  me: Me | null;
  error: string | null;
  /** UI gating only; the server checks every request again. */
  can: (permission: Permission) => boolean;
  /** Re-reads /auth/me (after registering, or after changing the business). */
  refresh: () => Promise<void>;
  /** Re-reads the Firebase user, e.g. after they click the verification link. */
  recheckVerification: () => Promise<void>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthApi | null>(null);

function isNotLinked(err: unknown): boolean {
  return err instanceof ApiError && err.statusCode === 404 && err.errors[0]?.message === "not_linked";
}

function needsVerification(user: User): boolean {
  const google = user.providerData.some((p) => p.providerId === "google.com");
  return !user.emailVerified && !google;
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient();
  const [status, setStatus] = useState<AuthStatus>(authClient.configured ? "loading" : "unconfigured");
  const [user, setUser] = useState<User | null>(null);
  const [me, setMe] = useState<Me | null>(null);
  const [error, setError] = useState<string | null>(null);
  // undefined = Firebase hasn't answered yet, so its first answer (even "signed out", null) always loads.
  const lastUid = useRef<string | null | undefined>(undefined);

  const load = useCallback(async (current: User | null) => {
    setUser(current);
    if (!current) {
      setMe(null);
      setStatus(authClient.configured ? "signedOut" : "unconfigured");
      return;
    }
    try {
      const result = await authEndpoints.me();
      setMe(result);
      setError(null);
      setStatus("ready");
    } catch (err) {
      setMe(null);
      if (isNotLinked(err)) setStatus(needsVerification(current) ? "unverified" : "notLinked");
      else {
        setError(errorMessage(err));
        setStatus("error");
      }
    }
  }, []);

  useEffect(() => {
    return authClient.onChange((next) => {
      const uid = next?.uid ?? null;
      // A different person on this device must never see the previous person's cached data.
      if (uid !== lastUid.current) {
        // Not on the first answer: no one was here before, and clearing cancels requests that public pages
        // (the customer portal, the booking page) have already started, leaving them loading forever.
        if (lastUid.current !== undefined) queryClient.clear();
        lastUid.current = uid;
        void load(next);
      }
    });
  }, [load, queryClient]);

  const refresh = useCallback(async () => {
    await load(authClient.currentUser());
  }, [load]);

  const recheckVerification = useCallback(async () => {
    await load(await authClient.reload());
  }, [load]);

  const signOut = useCallback(async () => {
    // Stop pushes to this device for the person leaving (best effort: never blocks signing out).
    if (pushClient.token()) {
      const pushToken = await pushClient.disable().catch(() => null);
      if (pushToken) await notificationEndpoints.removeDevice(pushToken).catch(() => undefined);
    }
    await authClient.signOut();
    queryClient.clear();
  }, [queryClient]);

  const value = useMemo<AuthApi>(() => {
    const granted = new Set(me?.permissions ?? []);
    return {
      status,
      user,
      me,
      error,
      can: (permission) => granted.has(permission),
      refresh,
      recheckVerification,
      signOut,
    };
  }, [status, user, me, error, refresh, recheckVerification, signOut]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthApi {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside AuthProvider");
  return ctx;
}
