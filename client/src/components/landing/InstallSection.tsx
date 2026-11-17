import { Bell, Check, Download, Share, SquarePlus, Zap } from "lucide-react";
import { useState } from "react";
import { useInstallApp } from "../../hooks/useInstallApp";
import { Accent, Reveal, SectionHeading } from "./Reveal";

/** iPhone and iPad Safari never offer an install prompt; people add the app from the Share menu instead. */
function isIos(): boolean {
  if (typeof navigator === "undefined") return false;
  return (
    /iphone|ipad|ipod/i.test(navigator.userAgent) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1)
  );
}

const PERKS = [
  { icon: Zap, text: "Opens straight from your home screen, full screen, like any app" },
  { icon: Bell, text: "Notifications for new bookings, payments and due orders" },
  { icon: Download, text: "Nothing to download from a store, and it's always up to date" },
];

const APPS = [
  "#f0c766",
  "#8fd8a8",
  "#9fc2f2",
  "#f2a3a5",
  "#cbbcc3",
  "#e7a6c6",
  "#f0c766",
  "#9fc2f2",
  "#8fd8a8",
  "#f2a3a5",
  "#cbbcc3",
];

export function InstallSection() {
  const app = useInstallApp();
  const [ios] = useState(isIos);
  const [installed, setInstalled] = useState(app.installed);

  const install = async () => {
    if (await app.install()) setInstalled(true);
  };

  return (
    <section id="install" aria-labelledby="install-title" className="overflow-hidden py-24 sm:py-32">
      <div className="mx-auto grid max-w-6xl items-center gap-14 px-4 sm:px-6 lg:grid-cols-[1.1fr_0.9fr] lg:gap-20">
        <div>
          <SectionHeading
            id="install-title"
            eyebrow="On your phone"
            title={
              <>
                Right there on the <Accent>cutting table.</Accent>
              </>
            }
            lead="TailorFlow installs on your phone, tablet or computer straight from the browser. Keep it beside the sewing machine and update an order with tape still around your neck."
          />

          <Reveal delay={100}>
            <ul className="mt-8 space-y-3">
              {PERKS.map(({ icon: Icon, text }) => (
                <li key={text} className="flex items-start gap-3 text-base text-fg-muted">
                  <span className="mt-0.5 grid size-7 shrink-0 place-items-center rounded-full bg-brand-soft text-link">
                    <Icon className="size-4" aria-hidden />
                  </span>
                  {text}
                </li>
              ))}
            </ul>

            <div className="mt-10" aria-live="polite">
              {installed ? (
                <p className="inline-flex items-center gap-2 rounded-full bg-success-bg px-4 py-2.5 text-sm font-medium text-success-fg">
                  <Check className="size-4" aria-hidden /> TailorFlow is installed. Open it from your home screen.
                </p>
              ) : app.available ? (
                <button
                  type="button"
                  onClick={() => void install()}
                  className="group inline-flex h-13 items-center gap-2 rounded-full bg-brand px-7 text-base font-semibold text-on-brand shadow-[0_14px_40px_-14px_var(--brand)] transition-transform hover:-translate-y-0.5 hover:bg-brand-hover"
                  data-cy="landing-install"
                >
                  <Download className="size-5 transition-transform group-hover:translate-y-0.5" aria-hidden />
                  Install the app
                </button>
              ) : ios ? (
                <ol
                  className="space-y-2 rounded-2xl border border-line bg-surface p-5 text-sm text-fg-muted"
                  data-cy="landing-install-ios"
                >
                  <li className="font-medium text-fg">To install on iPhone or iPad, in Safari:</li>
                  <li className="flex items-center gap-2">
                    1. Tap <Share className="size-4 text-link" aria-hidden /> Share
                  </li>
                  <li className="flex items-center gap-2">
                    2. Choose <SquarePlus className="size-4 text-link" aria-hidden /> Add to Home Screen
                  </li>
                </ol>
              ) : (
                <p className="max-w-md text-sm text-fg-subtle" data-cy="landing-install-hint">
                  Open TailorFlow in Chrome, Edge or Safari and use <strong className="text-fg">Install app</strong> or{" "}
                  <strong className="text-fg">Add to Home Screen</strong> from the browser menu.
                </p>
              )}
            </div>
          </Reveal>
        </div>

        <Reveal delay={150}>
          <HomeScreen />
        </Reveal>
      </div>
    </section>
  );
}

/** A phone home screen with TailorFlow landing on it. Decorative. */
function HomeScreen() {
  return (
    <div aria-hidden className="relative mx-auto w-full max-w-[17rem]">
      <div className="absolute -inset-10 -z-10 rounded-full bg-[radial-gradient(circle,var(--brand-soft),transparent_70%)]" />
      <div className="rotate-[4deg] rounded-[2.8rem] bg-[#0e060a] p-[9px] shadow-[0_50px_100px_-30px_rgb(42_34_38/0.6)]">
        <div className="relative aspect-[9/18.6] overflow-hidden rounded-[2.25rem] bg-[linear-gradient(160deg,#7a2f55,#2a0f1e_60%,#3d1430)] p-5 pt-14">
          <div className="absolute top-2.5 left-1/2 h-[22px] w-[84px] -translate-x-1/2 rounded-full bg-black" />
          <p className="text-center font-display text-4xl text-white/90">9:41</p>
          <p className="text-center text-[10px] text-white/60">Your workshop, in your pocket</p>
          <div className="mt-8 grid grid-cols-4 gap-x-3 gap-y-4">
            {APPS.map((c, i) => (
              <span key={i} className="flex flex-col items-center gap-1">
                <span className="aspect-square w-full rounded-[22%] opacity-80" style={{ background: c }} />
                <span className="h-1 w-6 rounded-full bg-white/25" />
              </span>
            ))}
            <span className="flex flex-col items-center gap-1">
              <img
                src="/icons/icon-192.png"
                alt=""
                className="lp-pop aspect-square w-full rounded-[22%] shadow-[0_0_0_3px_rgb(255_255_255/0.5),0_10px_30px_-5px_#000]"
                style={{ animationDelay: "0.6s" }}
              />
              <span className="text-[8px] font-medium text-white">TailorFlow</span>
            </span>
          </div>
          <div className="absolute inset-x-4 bottom-4 grid grid-cols-4 gap-3 rounded-3xl bg-white/15 p-3 backdrop-blur">
            {["#9fc2f2", "#8fd8a8", "#f0c766", "#e7a6c6"].map((c) => (
              <span key={c} className="aspect-square rounded-[22%] opacity-80" style={{ background: c }} />
            ))}
          </div>
        </div>
      </div>
      <div className="lp-float absolute top-24 -right-6 w-48 rounded-2xl border border-line bg-surface/95 p-3 shadow-2xl backdrop-blur sm:-right-14">
        <p className="flex items-center gap-1.5 text-[10px] font-semibold tracking-wide text-fg-subtle uppercase">
          <img src="/favicon.svg" alt="" className="size-3.5 rounded" /> TailorFlow · now
        </p>
        <p className="mt-1 text-xs font-semibold text-fg">New booking request</p>
        <p className="text-[11px] text-fg-muted">Ngozi wants a fitting on Saturday at 11:00.</p>
      </div>
    </div>
  );
}
