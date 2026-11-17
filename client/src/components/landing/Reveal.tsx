import type { CSSProperties, ReactNode } from "react";
import { cn } from "../../utils/cn";
import { useInView } from "./useLandingMotion";

/** Fades its children up the first time they scroll into view. */
export function Reveal({
  children,
  className,
  delay = 0,
}: {
  children: ReactNode;
  className?: string;
  delay?: number;
}) {
  const [ref, inView] = useInView<HTMLDivElement>();
  return (
    <div
      ref={ref}
      className={cn("lp-reveal", className)}
      data-visible={inView || undefined}
      style={{ "--lp-delay": `${delay}ms` } as CSSProperties}
    >
      {children}
    </div>
  );
}

interface SectionHeadingProps {
  id: string;
  eyebrow: string;
  title: ReactNode;
  lead?: ReactNode;
  align?: "left" | "center";
  tone?: "light" | "dark";
}

/** Eyebrow, serif heading (an <h2>) and lead paragraph: the opening of every landing section. */
export function SectionHeading({ id, eyebrow, title, lead, align = "left", tone = "light" }: SectionHeadingProps) {
  const dark = tone === "dark";
  return (
    <Reveal className={cn(align === "center" && "mx-auto text-center", "max-w-2xl")}>
      <p
        className={cn(
          "inline-flex items-center gap-2 text-xs font-semibold tracking-[0.2em] uppercase",
          dark ? "text-(--lp-blush)" : "text-link",
        )}
      >
        <span aria-hidden className="h-px w-6 bg-current" />
        {eyebrow}
      </p>
      <h2
        id={id}
        className={cn(
          "mt-4 font-display text-[clamp(2rem,4.6vw,3.4rem)] leading-[1.05] font-semibold tracking-tight text-balance",
          dark ? "text-(--lp-cream)" : "text-fg",
        )}
      >
        {title}
      </h2>
      {lead && (
        <p className={cn("mt-5 text-base leading-relaxed sm:text-lg", dark ? "text-[#e9d3de]" : "text-fg-muted")}>
          {lead}
        </p>
      )}
    </Reveal>
  );
}

/** The italic accent word in a heading. */
export function Accent({ children }: { children: ReactNode }) {
  return <em className="font-normal text-link italic">{children}</em>;
}
