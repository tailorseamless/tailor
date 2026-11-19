import { ArrowRight, Check } from "lucide-react";
import type { CSSProperties } from "react";
import { Link } from "react-router-dom";
import { SIGN_IN, SIGN_UP } from "./LandingHeader";
import { PhoneMock } from "./PhoneMock";
import { useReducedMotion } from "./useLandingMotion";

const delay = (ms: number) => ({ "--lp-delay": `${ms}ms` }) as CSSProperties;

const PROMISES = ["Works on any phone", "Installs like an app", "Customers need no account"];

export function Hero() {
  const reduced = useReducedMotion();

  return (
    <section id="top" aria-labelledby="hero-title" className="lp-atelier relative isolate overflow-hidden">
      <div aria-hidden className="lp-weave absolute inset-0 -z-10" />
      <div aria-hidden className="lp-glow -top-24 right-[-10%] size-[34rem] bg-[#9b3b6c]" />
      <div aria-hidden className="lp-glow bottom-[-30%] left-[-15%] size-[30rem] bg-[#6d2a4c] [animation-delay:-9s]" />
      <HeroThread reduced={reduced} />

      <div className="mx-auto grid max-w-6xl grid-cols-1 items-center gap-14 px-4 pt-28 pb-20 sm:px-6 lg:grid-cols-[1.08fr_0.92fr] lg:gap-10 lg:pt-36 lg:pb-32">
        <div className="relative">
          <p
            className="lp-fade-up inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/5 px-3 py-1.5 text-xs font-medium text-[#f3e3eb] backdrop-blur"
            style={delay(100)}
          >
            <span aria-hidden className="size-1.5 rounded-full bg-(--lp-brass) shadow-[0_0_10px_var(--lp-brass)]" />
            For tailors, fashion designers &amp; their teams
          </p>

          <h1
            id="hero-title"
            className="mt-6 font-display text-[clamp(2.6rem,6.6vw,4.6rem)] leading-[0.98] max-[359px]:text-[2.3rem] font-semibold tracking-[-0.025em] text-(--lp-cream)"
          >
            <span className="lp-line">
              <span style={delay(150)}>From the first</span>
            </span>
            <span className="lp-line">
              <span style={delay(280)}>measurement to</span>
            </span>
            <span className="lp-line">
              <span style={delay(410)}>
                the <em className="lp-shimmer pr-1 font-normal italic">final fitting.</em>
              </span>
            </span>
          </h1>

          <p
            className="lp-fade-up mt-7 max-w-xl text-base leading-relaxed text-[#e9d3de] sm:text-lg"
            style={delay(650)}
          >
            Tailor Seamless keeps your customers, measurements, orders, fittings and payments in one place, and keeps
            your customers in the loop. No more lost notebooks. No more <q>Is my outfit ready?</q> calls.
          </p>

          <div className="lp-fade-up mt-9 flex flex-col gap-3 sm:flex-row sm:items-center" style={delay(800)}>
            <Link
              to={SIGN_UP}
              className="group relative inline-flex h-13 items-center justify-center gap-2 overflow-hidden rounded-full bg-(--lp-cream) px-7 text-base font-semibold text-(--lp-plum) shadow-[0_10px_40px_-10px_rgb(232_180_205/0.6)] transition-transform hover:-translate-y-0.5"
              data-cy="hero-create-account"
            >
              Open your workshop
              <ArrowRight className="size-5 transition-transform group-hover:translate-x-1" aria-hidden />
            </Link>
            <Link
              to={SIGN_IN}
              className="inline-flex h-13 items-center justify-center rounded-full border border-white/25 bg-(--lp-ink)/40 px-7 text-base font-medium text-(--lp-cream) backdrop-blur-sm transition-colors hover:border-white/50 hover:bg-white/10"
              data-cy="hero-sign-in"
            >
              I already have an account
            </Link>
          </div>

          <ul className="lp-fade-up mt-8 flex flex-wrap gap-x-6 gap-y-2 text-sm text-[#e9d3de]" style={delay(950)}>
            {PROMISES.map((p) => (
              <li key={p} className="inline-flex items-center gap-2">
                <Check className="size-4 text-(--lp-brass)" aria-hidden />
                {p}
              </li>
            ))}
          </ul>
        </div>

        <div className="lp-fade-up relative" style={delay(500)}>
          <PhoneMock reduced={reduced} />
        </div>
      </div>

      {/* The seam where the dark hero meets the page. */}
      <svg aria-hidden className="absolute inset-x-0 bottom-0 h-6 w-full text-canvas" preserveAspectRatio="none">
        <rect y="12" width="100%" height="12" fill="currentColor" />
        <line
          x1="0"
          y1="5"
          x2="100%"
          y2="5"
          stroke="var(--lp-blush)"
          strokeOpacity=".5"
          strokeWidth="2"
          strokeDasharray="10 8"
        />
      </svg>
    </section>
  );
}

const THREAD = "M-60 780 C 180 650 320 900 560 770 S 900 380 1120 500 S 1380 330 1520 120";

/** A thread sewn across the hero; a needle leads it unless the person prefers less motion. */
function HeroThread({ reduced }: { reduced: boolean }) {
  return (
    <svg
      aria-hidden
      viewBox="0 0 1440 900"
      preserveAspectRatio="xMidYMid slice"
      className="pointer-events-none absolute inset-0 -z-10 size-full opacity-80"
    >
      <defs>
        <mask id="lp-thread-mask" maskUnits="userSpaceOnUse" x="-100" y="0" width="1700" height="1000">
          <path d={THREAD} pathLength={1} className="lp-draw" fill="none" stroke="#fff" strokeWidth="14" />
        </mask>
        <linearGradient id="lp-needle" x1="0" x2="1">
          <stop offset="0" stopColor="#9c8f95" />
          <stop offset=".6" stopColor="#f5eef1" />
          <stop offset="1" stopColor="#cfc4c9" />
        </linearGradient>
      </defs>
      <path d={THREAD} fill="none" stroke="#ffffff" strokeOpacity=".05" strokeWidth="10" />
      <g mask="url(#lp-thread-mask)">
        <path
          d={THREAD}
          fill="none"
          stroke="var(--lp-blush)"
          strokeWidth="3"
          strokeLinecap="round"
          strokeDasharray="16 12"
        />
        <path
          d={THREAD}
          fill="none"
          stroke="var(--lp-brass)"
          strokeOpacity=".35"
          strokeWidth="1"
          transform="translate(0 7)"
        />
      </g>
      {!reduced && (
        <g>
          <path d="M-30 -2.2 L14 -1 L22 0 L14 1 L-30 2.2 Q-34 0 -30 -2.2 Z" fill="url(#lp-needle)" />
          <ellipse cx="-25" cy="0" rx="3" ry="0.9" fill="var(--lp-ink)" />
          <animateMotion
            path={THREAD}
            dur="3.6s"
            begin="0s"
            fill="freeze"
            rotate="auto"
            calcMode="spline"
            keyPoints="0;0;1"
            keyTimes="0;0.111;1"
            keySplines="0 0 1 1;0.45 0 0.25 1"
          />
        </g>
      )}
    </svg>
  );
}
