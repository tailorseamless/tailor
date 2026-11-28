import {
  BarChart3,
  Bell,
  Boxes,
  CalendarDays,
  Camera,
  Images,
  Moon,
  Palette,
  Scissors,
  Smartphone,
  UserCog,
  Users,
  Wallet,
  type LucideIcon,
} from "lucide-react";
import type { ReactNode } from "react";
import { cn } from "../../utils/cn";
import { DiaryMini, MaterialsMini, OrdersMini, PaymentsMini, PortalMini, ReportsMini, TeamMini } from "./FeatureMinis";
import { Accent, Reveal, SectionHeading } from "./Reveal";
import { trackPointer } from "./useLandingMotion";

interface Feature {
  icon: LucideIcon;
  title: string;
  body: string;
  mini: ReactNode;
  span: string;
}

const FEATURES: Feature[] = [
  {
    icon: Scissors,
    title: "Every order, at a glance",
    body: "See what's being cut, sewn, fitted or waiting for fabric. Move an order along in a tap and everyone in the shop sees it.",
    mini: <OrdersMini />,
    span: "sm:col-span-2 lg:col-span-4",
  },
  {
    icon: Wallet,
    title: "Know who owes what",
    body: "Deposits, part payments and balances on every order, with receipts.",
    mini: <PaymentsMini />,
    span: "lg:col-span-2",
  },
  {
    icon: CalendarDays,
    title: "A diary that warns you",
    body: "Measurements, fittings and collections, with a warning before you double-book.",
    mini: <DiaryMini />,
    span: "lg:col-span-2",
  },
  {
    icon: Users,
    title: "Customers stay in the loop",
    body: "Each customer gets a private link to see progress and balance, and ask for a fitting. New customers book from your own page. Updates go out on WhatsApp, already written.",
    mini: <PortalMini />,
    span: "sm:col-span-2 lg:col-span-4",
  },
  {
    icon: Boxes,
    title: "Materials that don't run out",
    body: "Track fabric and trims, and see what's running low before it stops a job.",
    mini: <MaterialsMini />,
    span: "lg:col-span-2",
  },
  {
    icon: UserCog,
    title: "Your team, your branches",
    body: "Invite staff with the right access for their role, across every branch.",
    mini: <TeamMini />,
    span: "lg:col-span-2",
  },
  {
    icon: BarChart3,
    title: "Numbers you can trust",
    body: "Money in, expenses out, and how each month compares.",
    mini: <ReportsMini />,
    span: "sm:col-span-2 lg:col-span-2",
  },
];

const EXTRAS: { icon: LucideIcon; label: string }[] = [
  { icon: Camera, label: "Snap or upload old records" },
  { icon: Smartphone, label: "Installs on your phone" },
  { icon: Bell, label: "Phone notifications" },
  { icon: Images, label: "Photos on every order" },
  { icon: Palette, label: "Your style gallery" },
  { icon: Moon, label: "Light and dark mode" },
];

export function FeatureBento() {
  return (
    <section id="features" aria-labelledby="features-title" className="bg-subtle/60 py-24 sm:py-32">
      <div className="mx-auto max-w-6xl px-4 sm:px-6">
        <SectionHeading
          id="features-title"
          eyebrow="Everything in one place"
          align="center"
          title={
            <>
              The whole workshop, <Accent>beautifully</Accent> organised.
            </>
          }
          lead="Built around how tailoring businesses actually work: from the front desk to the cutting table."
        />

        <ul className="mt-16 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-6">
          {FEATURES.map((f, i) => (
            <li key={f.title} className={f.span}>
              <Reveal delay={(i % 3) * 90} className="h-full">
                <article
                  onPointerMove={trackPointer}
                  className="lp-spot group flex h-full flex-col overflow-hidden rounded-3xl border border-line bg-surface p-6 transition-[transform,border-color,box-shadow] duration-500 hover:-translate-y-1 hover:border-line-strong hover:shadow-[0_30px_60px_-30px_rgb(42_34_38/0.35)] sm:p-7"
                >
                  <span className="grid size-11 place-items-center rounded-2xl bg-brand-soft text-link transition-transform duration-500 group-hover:scale-110 group-hover:-rotate-6">
                    <f.icon className="size-5" aria-hidden />
                  </span>
                  <h3 className="mt-5 font-display text-xl font-semibold text-fg">{f.title}</h3>
                  <p className="mt-2 text-sm leading-relaxed text-fg-muted">{f.body}</p>
                  <div aria-hidden className={cn("mt-6 flex-1 content-end", "pointer-events-none select-none")}>
                    {f.mini}
                  </div>
                </article>
              </Reveal>
            </li>
          ))}
        </ul>

        <Reveal className="mt-10">
          <ul className="flex flex-wrap justify-center gap-2.5">
            {EXTRAS.map(({ icon: Icon, label }) => (
              <li
                key={label}
                className="inline-flex items-center gap-2 rounded-full border border-line bg-surface px-4 py-2 text-sm text-fg-muted"
              >
                <Icon className="size-4 text-link" aria-hidden />
                {label}
              </li>
            ))}
          </ul>
        </Reveal>
      </div>
    </section>
  );
}
