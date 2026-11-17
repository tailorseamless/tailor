import type { ReactNode } from "react";

export function Logo({ className }: { className?: string }) {
  return (
    <span className={className}>
      <img src="/favicon.svg" alt="" className="inline size-7 align-middle" />
      <span className="ml-2 align-middle font-display text-lg font-semibold text-fg">TailorFlow</span>
    </span>
  );
}

/** The centred card used by sign-in, verification and business setup. */
export function AuthLayout({ title, subtitle, children }: { title: string; subtitle?: string; children: ReactNode }) {
  return (
    <div className="flex min-h-dvh flex-col items-center bg-canvas px-4 py-10 sm:justify-center">
      <Logo className="mb-6" />
      <main className="w-full max-w-md rounded-2xl border border-line bg-surface p-6 shadow-pop sm:p-8">
        <h1 className="font-display text-2xl font-semibold text-fg">{title}</h1>
        {subtitle && <p className="mt-1 text-sm text-fg-muted">{subtitle}</p>}
        <div className="mt-6">{children}</div>
      </main>
    </div>
  );
}
