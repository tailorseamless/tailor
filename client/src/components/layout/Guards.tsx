import { Lock, MailCheck, Settings2 } from "lucide-react";
import { lazy, Suspense, useState } from "react";
import { Navigate, Outlet, useLocation } from "react-router-dom";
import { useAuth } from "../../contexts/AuthContext";
import { useToast } from "../../contexts/ToastContext";
import { authErrorMessage, authClient } from "../../lib/firebase";
import { installPrompt } from "../../lib/pwa";
import { RegisterBusinessForm } from "../../pages/auth/RegisterBusinessForm";
import { Button } from "../shared/Button";
import type { Permission } from "../../types/auth.types";
import { EmptyState, ErrorState, FullPageSpinner } from "../shared/States";
import { AuthLayout } from "./AuthLayout";

/** Loaded only for signed-out visitors, so the app never downloads it. */
const LandingPage = lazy(() => import("../../pages/public/LandingPage"));

function Landing() {
  return (
    <Suspense fallback={<FullPageSpinner />}>
      <LandingPage />
    </Suspense>
  );
}

/** Every signed-in screen sits behind this. It decides what a person sees before the app itself. */
export function RequireAuth() {
  const auth = useAuth();
  const location = useLocation();

  // A visitor at "/" meets the landing page. The installed app skips it and goes to sign-in.
  const landing = location.pathname === "/" && !installPrompt.installed();

  switch (auth.status) {
    case "loading":
      return <FullPageSpinner />;
    case "unconfigured":
      return landing ? <Landing /> : <Unconfigured />;
    case "signedOut": {
      if (landing) return <Landing />;
      const next = location.pathname + location.search;
      return <Navigate to={`/sign-in${next && next !== "/" ? `?next=${encodeURIComponent(next)}` : ""}`} replace />;
    }
    case "unverified":
      return <VerifyEmail />;
    case "notLinked":
      return (
        <AuthLayout title="Set up your business" subtitle="A few details and you're in.">
          <RegisterBusinessForm />
        </AuthLayout>
      );
    case "error":
      return (
        <AuthLayout title="We couldn't load your account">
          <ErrorState error={new Error(auth.error ?? "")} onRetry={() => void auth.refresh()} />
          <Button variant="ghost" className="w-full" onClick={() => void auth.signOut()} data-cy="error-sign-out">
            Sign out
          </Button>
        </AuthLayout>
      );
    case "ready":
      return <Outlet />;
  }
}

function Unconfigured() {
  return (
    <AuthLayout title="Sign-in isn't set up yet">
      <div className="flex gap-3 rounded-lg bg-info-bg p-4 text-sm text-info-fg">
        <Settings2 className="size-5 shrink-0" aria-hidden />
        <p>
          Add your Firebase web app values (<code>VITE_FIREBASE_API_KEY</code>, <code>VITE_FIREBASE_AUTH_DOMAIN</code>,{" "}
          <code>VITE_FIREBASE_PROJECT_ID</code>, <code>VITE_FIREBASE_APP_ID</code>) to <code>client/.env</code>, then
          restart the dev server.
        </p>
      </div>
    </AuthLayout>
  );
}

function VerifyEmail() {
  const auth = useAuth();
  const toast = useToast();
  const [busy, setBusy] = useState<"check" | "resend" | null>(null);

  const run = async (kind: "check" | "resend") => {
    setBusy(kind);
    try {
      if (kind === "resend") {
        await authClient.resendVerification();
        toast.success("We sent the link again. Check your inbox and spam folder.");
      } else {
        await auth.recheckVerification();
      }
    } catch (err) {
      toast.error(authErrorMessage(err));
    } finally {
      setBusy(null);
    }
  };

  return (
    <AuthLayout title="Confirm your email">
      <div className="flex flex-col items-center text-center">
        <div className="mb-3 rounded-full bg-brand-soft p-3 text-link">
          <MailCheck className="size-6" aria-hidden />
        </div>
        <p className="text-sm text-fg-muted">
          We sent a link to <strong className="text-fg">{auth.user?.email}</strong>. Open it, then come back here.
        </p>
      </div>
      <div className="mt-6 space-y-2">
        <Button className="w-full" loading={busy === "check"} onClick={() => void run("check")} data-cy="verify-check">
          I've confirmed it
        </Button>
        <Button
          variant="secondary"
          className="w-full"
          loading={busy === "resend"}
          onClick={() => void run("resend")}
          data-cy="verify-resend"
        >
          Send the link again
        </Button>
        <Button variant="ghost" className="w-full" onClick={() => void auth.signOut()} data-cy="verify-sign-out">
          Use a different account
        </Button>
      </div>
    </AuthLayout>
  );
}

/** A screen only some roles may open. The server enforces this too; this just explains it. */
export function Gate({ permission }: { permission: Permission }) {
  const { can } = useAuth();
  if (can(permission)) return <Outlet />;
  return (
    <EmptyState
      icon={<Lock className="size-6" aria-hidden />}
      title="You don't have access to this"
      message="Ask the business owner if you need it."
    />
  );
}
