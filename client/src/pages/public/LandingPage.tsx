import { useEffect } from "react";
import { ClosingCta, LandingFooter } from "../../components/landing/ClosingCta";
import { FeatureBento } from "../../components/landing/FeatureBento";
import { Hero } from "../../components/landing/Hero";
import { InstallSection } from "../../components/landing/InstallSection";
import { JourneySection } from "../../components/landing/JourneySection";
import { LandingHeader } from "../../components/landing/LandingHeader";
import { Marquee } from "../../components/landing/Marquee";
import { MeasureSection } from "../../components/landing/MeasureSection";
import { SnapSection } from "../../components/landing/SnapSection";
import { Faq, Steps } from "../../components/landing/StepsFaq";
import "../../components/landing/landing.css";

/** What a signed-out visitor sees at "/". Signed-in people go straight to the app (see RequireAuth). */
export default function LandingPage() {
  useEffect(() => {
    const previous = document.title;
    document.title = "Tailor Seamless · Orders, measurements and payments for tailors";
    document.documentElement.classList.add("lp-smooth");
    return () => {
      document.title = previous;
      document.documentElement.classList.remove("lp-smooth");
    };
  }, []);

  return (
    <div className="lp min-h-dvh overflow-x-clip bg-canvas text-fg">
      <a
        href="#main"
        className="sr-only z-50 rounded-lg bg-surface px-4 py-2 text-sm font-medium text-fg shadow-pop focus:not-sr-only focus:fixed focus:top-3 focus:left-3"
        data-cy="landing-skip"
      >
        Skip to content
      </a>
      <LandingHeader />
      <main id="main" tabIndex={-1} className="outline-none">
        <Hero />
        <Marquee />
        <SnapSection />
        <MeasureSection />
        <JourneySection />
        <FeatureBento />
        <InstallSection />
        <Steps />
        <Faq />
        <ClosingCta />
      </main>
      <LandingFooter />
    </div>
  );
}
