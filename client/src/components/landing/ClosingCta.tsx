import { ArrowRight } from "lucide-react";
import { Link } from "react-router-dom";
import { SIGN_IN, SIGN_UP } from "./LandingHeader";
import { Reveal } from "./Reveal";

export function ClosingCta() {
  return (
    <section aria-labelledby="cta-title" className="px-4 pb-24 sm:px-6 sm:pb-32">
      <Reveal>
        <div className="lp-atelier relative isolate mx-auto max-w-6xl overflow-hidden rounded-[2.5rem] px-6 py-20 text-center sm:px-12 sm:py-28">
          <div aria-hidden className="lp-weave absolute inset-0 -z-10" />
          <div aria-hidden className="lp-glow top-[-40%] left-1/2 size-[36rem] -translate-x-1/2 bg-[#9b3b6c]" />
          {/* A running stitch around the edge, sewing itself. */}
          <svg
            aria-hidden
            className="pointer-events-none absolute inset-3 size-[calc(100%-1.5rem)] sm:inset-4 sm:size-[calc(100%-2rem)]"
          >
            <rect
              x="1"
              y="1"
              style={{ width: "calc(100% - 2px)", height: "calc(100% - 2px)" }}
              rx="30"
              fill="none"
              stroke="var(--lp-blush)"
              strokeOpacity=".55"
              strokeWidth="2"
              strokeDasharray="10 9"
              className="lp-march"
            />
          </svg>

          <p className="font-display text-sm tracking-[0.25em] text-(--lp-blush) uppercase">Your atelier, organised</p>
          <h2
            id="cta-title"
            className="mx-auto mt-5 max-w-3xl font-display text-[clamp(2.2rem,6vw,4.5rem)] leading-[1.02] font-semibold tracking-tight text-balance text-(--lp-cream)"
          >
            Your craft deserves better than a <em className="lp-shimmer pr-1 font-normal italic">notebook.</em>
          </h2>
          <p className="mx-auto mt-6 max-w-xl text-base leading-relaxed text-[#e9d3de] sm:text-lg">
            Bring your customers, measurements, orders and money together today. Start by snapping a page of your
            notebook. Your future self, and your customers, will thank you.
          </p>
          <div className="mt-10 flex flex-col items-center justify-center gap-3 sm:flex-row">
            <Link
              to={SIGN_UP}
              className="group inline-flex h-13 w-full items-center justify-center gap-2 rounded-full bg-(--lp-cream) px-4 text-base font-semibold whitespace-nowrap text-(--lp-plum) sm:px-8shadow-[0_10px_40px_-10px_rgb(232_180_205/0.6)] transition-transform hover:-translate-y-0.5 sm:w-auto"
              data-cy="cta-create-account"
            >
              Open your workshop
              <ArrowRight className="size-5 transition-transform group-hover:translate-x-1" aria-hidden />
            </Link>
            <Link
              to={SIGN_IN}
              className="inline-flex h-13 w-full items-center justify-center rounded-full border border-white/25 px-8 text-base font-medium text-(--lp-cream) transition-colors hover:border-white/50 hover:bg-white/5 sm:w-auto"
              data-cy="cta-sign-in"
            >
              Sign in
            </Link>
          </div>
        </div>
      </Reveal>
    </section>
  );
}

export function LandingFooter() {
  const year = new Date().getFullYear();
  return (
    <footer className="border-t border-line">
      <div className="mx-auto flex max-w-6xl flex-col gap-8 px-4 py-12 sm:flex-row sm:items-center sm:justify-between sm:px-6">
        <div>
          <p className="flex items-center gap-2 font-display text-lg font-semibold text-fg">
            <img src="/favicon.svg" alt="" className="size-7" />
            Tailor Seamless
          </p>
          <p className="mt-2 max-w-xs text-sm text-fg-subtle">
            Customers, measurements, orders and payments for tailors and fashion designers.
          </p>
        </div>
        <nav aria-label="Footer">
          <ul className="flex flex-wrap gap-x-6 gap-y-2 text-sm">
            {[
              { href: "#snap", label: "Snap a record" },
              { href: "#features", label: "Features" },
              { href: "#measurements", label: "Measurements" },
              { href: "#install", label: "Get the app" },
              { href: "#faq", label: "Questions" },
            ].map((l) => (
              <li key={l.href}>
                <a href={l.href} className="text-fg-muted hover:text-fg" data-cy={`footer-${l.href.slice(1)}`}>
                  {l.label}
                </a>
              </li>
            ))}
            <li>
              <Link to={SIGN_IN} className="text-fg-muted hover:text-fg" data-cy="footer-sign-in">
                Sign in
              </Link>
            </li>
            <li>
              <Link to={SIGN_UP} className="font-medium text-link hover:underline" data-cy="footer-sign-up">
                Create an account
              </Link>
            </li>
          </ul>
        </nav>
      </div>
      <div className="border-t border-line">
        <p className="mx-auto max-w-6xl px-4 py-5 text-xs text-fg-subtle sm:px-6">
          © {year} Tailor Seamless. Made with care for the people who make our clothes.
        </p>
      </div>
    </footer>
  );
}
