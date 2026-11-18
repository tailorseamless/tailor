import { ArrowLeft } from "lucide-react";
import type { ReactNode } from "react";
import { Link } from "react-router-dom";
import { installPrompt } from "../../lib/pwa";

export function Logo({ className }: { className?: string }) {
  return (
    <span className={className}>
      <img src="/favicon.svg" alt="" className="inline size-7 align-middle" />
      <span className="ml-2 align-middle font-display text-lg font-semibold text-fg">Tailor Seamless</span>
    </span>
  );
}

interface AuthLayoutProps {
  title: string;
  subtitle?: string;
  children: ReactNode;
  /** Offer a way back to the landing page (sign-in only: the other screens are in the middle of setting up). */
  homeLink?: boolean;
}

/** The centred card used by sign-in, verification and business setup. */
export function AuthLayout({ title, subtitle, children, homeLink }: AuthLayoutProps) {
  // The installed app skips the landing page, so "/" would only bring the person back to this screen.
  const showHome = homeLink && !installPrompt.installed();
  return (
    <div className="flex min-h-dvh flex-col items-center bg-canvas px-4 py-10 sm:justify-center">
      {showHome ? (
        <Link to="/" aria-label="Tailor Seamless home" className="mb-6 rounded-lg" data-cy="auth-logo-home">
          <Logo />
        </Link>
      ) : (
        <Logo className="mb-6" />
      )}
      <main className="w-full max-w-md rounded-2xl border border-line bg-surface p-6 shadow-pop sm:p-8">
        <h1 className="font-display text-2xl font-semibold text-fg">{title}</h1>
        {subtitle && <p className="mt-1 text-sm text-fg-muted">{subtitle}</p>}
        <div className="mt-6">{children}</div>
      </main>
      {showHome && (
        <Link
          to="/"
          className="mt-6 inline-flex min-h-10 items-center gap-1.5 rounded-lg px-3 text-sm text-fg-muted hover:text-fg"
          data-cy="auth-back-home"
        >
          <ArrowLeft className="size-4" aria-hidden />
          Back to home
        </Link>
      )}
    </div>
  );
}
