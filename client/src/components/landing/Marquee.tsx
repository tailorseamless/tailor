import { Scissors } from "lucide-react";
import { useReducedMotion } from "./useLandingMotion";

const GARMENTS = [
  "Agbada",
  "Bridal gowns",
  "Bespoke suits",
  "Aso-ebi",
  "Kaftans",
  "Iro & bùbá",
  "Senator wear",
  "Evening dresses",
  "Ankara two-pieces",
  "School uniforms",
  "Children's wear",
  "Alterations",
];

/** An endless ribbon of the garments TailorFlow is made for. The copy is doubled so the loop is seamless. */
export function Marquee() {
  const reduced = useReducedMotion();
  const row = (hidden: boolean) => (
    <ul aria-hidden={hidden || undefined} className="flex shrink-0 items-center">
      {GARMENTS.map((g) => (
        <li key={g} className="flex items-center">
          <span className="px-6 font-display text-2xl whitespace-nowrap text-fg italic sm:text-3xl">{g}</span>
          <Scissors className="size-4 -rotate-90 text-link" aria-hidden />
        </li>
      ))}
    </ul>
  );

  return (
    <section aria-label="Made for every garment" className="border-y border-line bg-brand-soft/60 py-6">
      <div className="lp-marquee-wrap overflow-hidden">
        <div className={reduced ? "flex flex-wrap justify-center gap-y-2" : "lp-marquee flex w-max"}>
          {row(false)}
          {!reduced && row(true)}
        </div>
      </div>
    </section>
  );
}
