import { Plus } from "lucide-react";
import { Accent, Reveal, SectionHeading } from "./Reveal";

const STEPS = [
  {
    title: "Open your workshop",
    body: "Sign up with your email or Google and name your business. Add your branches and invite your team when you're ready.",
  },
  {
    title: "Add customers and measurements",
    body: "Build a measurement template for each kind of garment you make. Each customer's sizes are saved once and ready for every order.",
  },
  {
    title: "Take orders and get paid",
    body: "Record the garments, the deposit and the due date. Move the order along, share the customer's link, and watch the balance clear.",
  },
];

export function Steps() {
  return (
    <section id="how" aria-labelledby="how-title" className="bg-subtle/60 py-24 sm:py-32">
      <div className="mx-auto max-w-6xl px-4 sm:px-6">
        <SectionHeading
          id="how-title"
          eyebrow="Getting started"
          align="center"
          title={
            <>
              Up and running <Accent>this afternoon.</Accent>
            </>
          }
        />
        <div className="relative mt-16">
          <span
            aria-hidden
            className="pointer-events-none absolute top-12 right-[16%] left-[16%] hidden border-t-2 border-dashed border-line-strong md:block"
          />
          <ol className="grid grid-cols-1 gap-6 md:grid-cols-3 md:gap-8">
            {STEPS.map((s, i) => (
              <li key={s.title} className="relative">
                <Reveal delay={i * 140} className="h-full">
                  <div className="flex h-full flex-col items-center rounded-3xl border border-line bg-surface p-8 text-center">
                    <span className="relative grid size-16 place-items-center rounded-full bg-(--lp-ink) font-display text-3xl text-(--lp-cream) italic shadow-[0_0_0_8px_var(--surface)]">
                      {i + 1}
                      <span
                        aria-hidden
                        className="absolute -inset-2 rounded-full border border-dashed border-line-strong"
                      />
                    </span>
                    <h3 className="mt-6 font-display text-xl font-semibold text-fg">{s.title}</h3>
                    <p className="mt-2 text-sm leading-relaxed text-fg-muted">{s.body}</p>
                  </div>
                </Reveal>
              </li>
            ))}
          </ol>
        </div>
      </div>
    </section>
  );
}

const FAQS = [
  {
    q: "Does it work on my phone?",
    a: "Yes. Tailor Seamless works in any modern browser on phones, tablets and computers, and you can install it on your home screen so it opens like an app, with notifications.",
  },
  {
    q: "Do my customers need to download anything?",
    a: "No. Each customer gets a private link to see their orders, balance and appointments, and to ask for a fitting. New customers can book from your booking page. No app, no account, no password.",
  },
  {
    q: "Can my staff use it too?",
    a: "Yes. Invite your team and give each person a role: manager, tailor, receptionist, accountant or apprentice. Each person only sees what their role allows, across one branch or many.",
  },
  {
    q: "Does it work in naira?",
    a: "Yes. Every price, payment, receipt and report is in naira (₦) by default. If your business works in another currency, contact support and we'll switch it for you.",
  },
  {
    q: "How do WhatsApp updates work?",
    a: "From any order, Tailor Seamless writes the message for you: the garment, the stage it's at, the balance. Tap once to open it in WhatsApp with your customer's chat ready, then press send.",
  },
  {
    q: "Is my business data private?",
    a: "Each workshop's data is kept separate, and every request is checked against the person's role. You can export your records from Reports, and delete your business from Settings at any time.",
  },
];

export function Faq() {
  return (
    <section id="faq" aria-labelledby="faq-title" className="py-24 sm:py-32">
      <div className="mx-auto grid max-w-6xl grid-cols-1 gap-12 px-4 sm:px-6 lg:grid-cols-[0.8fr_1.2fr] lg:gap-20">
        <SectionHeading
          id="faq-title"
          eyebrow="Questions"
          title={
            <>
              Good to <Accent>know.</Accent>
            </>
          }
          lead="Everything tailors usually ask before they switch from the notebook."
        />
        <Reveal delay={100}>
          <div className="divide-y divide-line border-y border-line">
            {FAQS.map((f, i) => (
              <details key={f.q} className="lp-faq group" data-cy={`faq-${i}`}>
                <summary className="flex cursor-pointer list-none items-center justify-between gap-6 rounded-lg py-5 text-left font-display text-lg font-semibold text-fg transition-colors hover:text-link">
                  {f.q}
                  <span className="grid size-8 shrink-0 place-items-center rounded-full border border-line transition-colors group-open:border-brand group-open:bg-brand group-open:text-on-brand">
                    <Plus className="lp-faq-icon size-4 transition-transform duration-300" aria-hidden />
                  </span>
                </summary>
                <p className="-mt-1 pr-12 pb-6 text-base leading-relaxed text-fg-muted">{f.a}</p>
              </details>
            ))}
          </div>
        </Reveal>
      </div>
    </section>
  );
}
