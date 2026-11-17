import { zodResolver } from "@hookform/resolvers/zod";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { Navigate, useSearchParams } from "react-router-dom";
import { z } from "zod";
import { AuthLayout } from "../../components/layout/AuthLayout";
import { Button } from "../../components/shared/Button";
import { Field, FormError, Input } from "../../components/shared/Field";
import { FullPageSpinner } from "../../components/shared/States";
import { useAuth } from "../../contexts/AuthContext";
import { useToast } from "../../contexts/ToastContext";
import { authClient, authErrorMessage } from "../../lib/firebase";

type Mode = "signIn" | "signUp" | "reset";

const schema = z.object({
  email: z.string().trim().email("Enter a valid email address"),
  password: z.string(),
});
type Values = z.infer<typeof schema>;

const copy: Record<Mode, { title: string; subtitle: string; submit: string }> = {
  signIn: { title: "Welcome back", subtitle: "Sign in to your workshop.", submit: "Sign in" },
  signUp: {
    title: "Create your account",
    subtitle: "Start managing orders, measurements and payments.",
    submit: "Create account",
  },
  reset: {
    title: "Reset your password",
    subtitle: "We'll email you a link to choose a new one.",
    submit: "Send reset link",
  },
};

/** Only allow going back to a page inside the app. */
function safeNext(next: string | null): string {
  return next && next.startsWith("/") && !next.startsWith("//") ? next : "/";
}

export default function SignInPage() {
  const auth = useAuth();
  const toast = useToast();
  const [params] = useSearchParams();
  const [mode, setMode] = useState<Mode>(params.get("mode") === "signUp" ? "signUp" : "signIn");
  const [formError, setFormError] = useState<string | null>(null);
  const [googleBusy, setGoogleBusy] = useState(false);
  const form = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: { email: params.get("email") ?? "", password: "" },
  });

  if (auth.status === "loading") return <FullPageSpinner />;
  if (auth.status !== "signedOut" && auth.status !== "unconfigured")
    return <Navigate to={safeNext(params.get("next"))} replace />;

  const submit = form.handleSubmit(async ({ email, password }) => {
    setFormError(null);
    if (mode !== "reset" && password.length < (mode === "signUp" ? 8 : 1)) {
      form.setError("password", { message: mode === "signUp" ? "Use at least 8 characters" : "Enter your password" });
      return;
    }
    try {
      if (mode === "reset") {
        await authClient.resetPassword(email);
        toast.success("If that email has an account, a reset link is on its way.");
        setMode("signIn");
      } else if (mode === "signUp") {
        await authClient.signUp(email, password);
      } else {
        await authClient.signIn(email, password);
      }
    } catch (err) {
      setFormError(authErrorMessage(err));
    }
  });

  const google = async () => {
    setFormError(null);
    setGoogleBusy(true);
    try {
      await authClient.signInWithGoogle();
    } catch (err) {
      setFormError(authErrorMessage(err));
    } finally {
      setGoogleBusy(false);
    }
  };

  const text = copy[mode];
  const errors = form.formState.errors;
  return (
    <AuthLayout title={text.title} subtitle={text.subtitle}>
      {!authClient.configured && (
        <FormError message="Sign-in isn't set up yet: add the VITE_FIREBASE_* values to client/.env and restart." />
      )}
      <form onSubmit={submit} className="space-y-4" noValidate>
        <FormError message={formError} />
        <Field label="Email" error={errors.email?.message}>
          {(p) => (
            <Input {...p} type="email" autoComplete="email" {...form.register("email")} data-cy="sign-in-email" />
          )}
        </Field>
        {mode !== "reset" && (
          <Field
            label="Password"
            error={errors.password?.message}
            hint={mode === "signUp" ? "At least 8 characters." : undefined}
          >
            {(p) => (
              <Input
                {...p}
                type="password"
                autoComplete={mode === "signUp" ? "new-password" : "current-password"}
                {...form.register("password")}
                data-cy="sign-in-password"
              />
            )}
          </Field>
        )}
        {mode === "signIn" && (
          <button
            type="button"
            className="text-sm text-link hover:underline"
            onClick={() => setMode("reset")}
            data-cy="forgot-password"
          >
            Forgot your password?
          </button>
        )}
        <Button
          type="submit"
          className="w-full"
          loading={form.formState.isSubmitting}
          disabled={!authClient.configured}
          data-cy="sign-in-submit"
        >
          {text.submit}
        </Button>
      </form>

      {mode !== "reset" && (
        <>
          <div className="my-5 flex items-center gap-3 text-xs text-fg-subtle">
            <span className="h-px flex-1 bg-line" /> or <span className="h-px flex-1 bg-line" />
          </div>
          <Button
            variant="secondary"
            className="w-full"
            onClick={() => void google()}
            loading={googleBusy}
            disabled={!authClient.configured}
            data-cy="sign-in-google"
          >
            Continue with Google
          </Button>
        </>
      )}

      <p className="mt-6 text-center text-sm text-fg-muted">
        {mode === "signIn" ? "New to TailorFlow? " : "Already have an account? "}
        <button
          type="button"
          className="font-medium text-link hover:underline"
          onClick={() => {
            setFormError(null);
            setMode(mode === "signIn" ? "signUp" : "signIn");
          }}
          data-cy="switch-mode"
        >
          {mode === "signIn" ? "Create an account" : "Sign in"}
        </button>
      </p>
    </AuthLayout>
  );
}
