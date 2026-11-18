import { ArrowRight, Download } from "lucide-react";
import { Link } from "react-router-dom";
import { useInstallApp } from "../../hooks/useInstallApp";
import { cn } from "../../utils/cn";
import { useScrolled } from "./useLandingMotion";

export const SIGN_UP = "/sign-in?mode=signUp";
export const SIGN_IN = "/sign-in";

const LINKS = [
  { href: "#measurements", label: "Measurements" },
  { href: "#journey", label: "Customers" },
  { href: "#features", label: "Features" },
  { href: "#install", label: "Get the app" },
  { href: "#faq", label: "Questions" },
];

/** Transparent over the hero, a frosted bar once the page scrolls. */
export function LandingHeader() {
  const scrolled = useScrolled();
  const app = useInstallApp();

  return (
    <header
      className={cn(
        "fixed inset-x-0 top-0 z-40 transition-[background-color,border-color,box-shadow] duration-300",
        scrolled
          ? "border-b border-line bg-surface/85 shadow-[0_8px_30px_-20px_rgb(42_34_38/0.5)] backdrop-blur-xl"
          : "border-b border-transparent",
      )}
    >
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-3 px-4 sm:gap-4 sm:px-6">
        <a
          href="#top"
          className={cn(
            "flex shrink-0 items-center gap-2 rounded-lg font-display text-base font-semibold whitespace-nowrap sm:text-lg",
            scrolled ? "text-fg" : "text-(--lp-cream)",
          )}
          data-cy="landing-logo"
        >
          <img src="/favicon.svg" alt="" className="size-7 sm:size-8" />
          Tailor Seamless
        </a>

        <nav aria-label="Page sections" className="hidden lg:block">
          <ul className="flex items-center gap-1">
            {LINKS.map((l) => (
              <li key={l.href}>
                <a
                  href={l.href}
                  className={cn(
                    "rounded-lg px-3 py-2 text-sm font-medium transition-colors",
                    scrolled
                      ? "text-fg-muted hover:bg-subtle hover:text-fg"
                      : "text-[#e9d3de] hover:bg-white/10 hover:text-white",
                  )}
                  data-cy={`landing-nav-${l.href.slice(1)}`}
                >
                  {l.label}
                </a>
              </li>
            ))}
          </ul>
        </nav>

        <div className="flex shrink-0 items-center gap-1 sm:gap-2">
          {app.available && (
            <button
              type="button"
              onClick={() => void app.install()}
              className={cn(
                "hidden h-10 items-center gap-1.5 rounded-lg px-3 text-sm font-medium transition-colors sm:inline-flex",
                scrolled ? "text-fg-muted hover:bg-subtle hover:text-fg" : "text-[#f3e3eb] hover:bg-white/10",
              )}
              aria-label="Install the app"
              title="Install the app"
              data-cy="landing-header-install"
            >
              <Download className="size-4" aria-hidden />
              <span className="hidden xl:inline">Install</span>
            </button>
          )}
          <Link
            to={SIGN_IN}
            className={cn(
              "hidden h-10 items-center rounded-lg px-3 text-sm font-medium whitespace-nowrap transition-colors min-[380px]:inline-flex",
              scrolled ? "text-fg-muted hover:bg-subtle hover:text-fg" : "text-[#f3e3eb] hover:bg-white/10",
            )}
            data-cy="landing-sign-in"
          >
            Sign in
          </Link>
          <Link
            to={SIGN_UP}
            className={cn(
              "group inline-flex h-10 items-center gap-1.5 rounded-full px-4 text-sm font-semibold whitespace-nowrap transition-all",
              scrolled
                ? "bg-brand text-on-brand hover:bg-brand-hover"
                : "bg-(--lp-cream) text-(--lp-plum) hover:bg-white",
            )}
            data-cy="landing-get-started"
          >
            Get started
            <ArrowRight
              className="hidden size-4 transition-transform group-hover:translate-x-0.5 sm:block"
              aria-hidden
            />
          </Link>
        </div>
      </div>

      {/* A line of stitches that sews itself across as you scroll. */}
      <svg aria-hidden className="lp-progress absolute inset-x-0 -bottom-px h-[3px] w-full" preserveAspectRatio="none">
        <line x1="0" y1="1.5" x2="100%" y2="1.5" stroke="var(--focus)" strokeWidth="3" strokeDasharray="8 5" />
      </svg>
    </header>
  );
}
