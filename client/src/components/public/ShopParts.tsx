import { Mail, MapPin, MessageCircle, Palette, Phone, Share2 } from "lucide-react";
import { useMemo, useState, type ReactNode } from "react";
import type { PublicBusiness, PublicDesign } from "../../types/portal.types";
import { cn } from "../../utils/cn";
import { resizedImage } from "../../utils/imageUrl";
import { formatPriceRange } from "../../utils/money";
import { whatsappLink } from "../../utils/validation";
import { Button, buttonClass } from "../shared/Button";
import { FilterChips } from "../shared/Display";
import { Modal } from "../shared/Modal";

/** A picture at a size that suits where it's shown; falls back to the original if the smaller copy won't load. */
export function Photo({ url, alt, width, className }: { url: string; alt: string; width: number; className?: string }) {
  const [failed, setFailed] = useState(false);
  return (
    <img
      src={failed ? url : resizedImage(url, width)}
      alt={alt}
      loading="lazy"
      decoding="async"
      className={className}
      onError={() => setFailed(true)}
    />
  );
}

const mapsLink = (address: string) => `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(address)}`;

/** The shop's page: name, how to reach them, and the share button. */
export function ShopLayout({
  business,
  onShare,
  children,
}: {
  business: PublicBusiness;
  onShare: () => void;
  children: ReactNode;
}) {
  const greeting = `Hello ${business.name}, I found your page and I'd like to ask about a style.`;
  return (
    <div className="min-h-dvh bg-canvas">
      <header className="border-b border-line bg-surface">
        <div className="mx-auto max-w-5xl px-4 py-8 sm:py-10">
          <div className="flex items-start justify-between gap-3">
            <h1 className="font-display text-3xl font-semibold text-fg sm:text-4xl" data-cy="shop-name">
              {business.name}
            </h1>
            <Button
              variant="secondary"
              size="sm"
              icon={<Share2 className="size-4" aria-hidden />}
              onClick={onShare}
              data-cy="shop-share"
            >
              Share
            </Button>
          </div>
          {business.address && (
            <p className="mt-2 inline-flex items-start gap-1.5 text-sm text-fg-muted" data-cy="shop-address">
              <MapPin className="mt-0.5 size-4 shrink-0" aria-hidden /> {business.address}
            </p>
          )}
          <div className="mt-5 flex flex-wrap gap-2">
            {business.phone && (
              <a href={`tel:${business.phone}`} className={buttonClass("primary")} data-cy="shop-call">
                <Phone className="size-4" aria-hidden /> Call {business.phone}
              </a>
            )}
            {business.phone && (
              <a
                href={whatsappLink(greeting, business.phone)}
                target="_blank"
                rel="noreferrer"
                className={buttonClass("secondary")}
                data-cy="shop-whatsapp"
              >
                <MessageCircle className="size-4" aria-hidden /> WhatsApp
              </a>
            )}
            {business.email && (
              <a href={`mailto:${business.email}`} className={buttonClass("secondary")} data-cy="shop-email">
                <Mail className="size-4" aria-hidden /> Email
              </a>
            )}
            {business.address && (
              <a
                href={mapsLink(business.address)}
                target="_blank"
                rel="noreferrer"
                className={buttonClass("secondary")}
                data-cy="shop-directions"
              >
                <MapPin className="size-4" aria-hidden /> Directions
              </a>
            )}
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-5xl space-y-8 px-4 py-8">{children}</main>
      <footer className="pb-8 text-center text-xs text-fg-subtle">Powered by Tailor Seamless</footer>
    </div>
  );
}

const OTHER = "__other";

/** The designs a business shows, by category, each with its price range; tap one for all its pictures. */
export function ShopDesigns({
  designs,
  business,
  bookingOpen,
  onBook,
}: {
  designs: PublicDesign[];
  business: PublicBusiness;
  bookingOpen: boolean;
  /** "Book a fitting for this style": the page scrolls to the booking form with the style in the note. */
  onBook: (design: PublicDesign) => void;
}) {
  const [filter, setFilter] = useState("all");
  const [openId, setOpenId] = useState<string | null>(null);
  // A style with no picture is no use to a visitor, so it isn't listed.
  const listed = useMemo(() => designs.filter((d) => d.images.length), [designs]);
  const categories = useMemo(() => {
    const seen = new Map<string, string>();
    for (const d of listed)
      if (d.category && !seen.has(d.category.toLowerCase())) seen.set(d.category.toLowerCase(), d.category);
    return [...seen].sort((a, b) => a[1].localeCompare(b[1]));
  }, [listed]);
  const hasOther = categories.length > 0 && listed.some((d) => !d.category);

  const shown = listed.filter((d) => {
    if (filter === "all") return true;
    if (filter === OTHER) return !d.category;
    return d.category?.toLowerCase() === filter;
  });
  const open = listed.find((d) => d.id === openId);

  if (!listed.length) {
    return (
      <section
        aria-labelledby="shop-designs-title"
        className="rounded-xl border border-line bg-surface px-6 py-12 text-center"
      >
        <Palette className="mx-auto size-8 text-fg-subtle" aria-hidden />
        <h2 id="shop-designs-title" className="mt-3 font-display text-lg font-semibold text-fg">
          No designs to show yet
        </h2>
        <p className="mt-1 text-sm text-fg-muted">Get in touch to talk about what you'd like made.</p>
      </section>
    );
  }

  return (
    <section aria-labelledby="shop-designs-title" className="space-y-4">
      <h2 id="shop-designs-title" className="font-display text-xl font-semibold text-fg">
        Our designs
      </h2>
      {categories.length > 0 && (
        <FilterChips
          label="Category"
          value={filter}
          onChange={setFilter}
          options={[
            { value: "all", label: "All" },
            ...categories.map(([value, label]) => ({ value, label })),
            ...(hasOther ? [{ value: OTHER, label: "Other" }] : []),
          ]}
        />
      )}
      <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4 lg:grid-cols-4">
        {shown.map((d) => {
          const price = formatPriceRange(d.priceMin, d.priceMax, business.currency);
          return (
            <li key={d.id}>
              <button
                type="button"
                onClick={() => setOpenId(d.id)}
                className="group block w-full overflow-hidden rounded-xl border border-line bg-surface text-left transition hover:border-line-strong hover:shadow-pop"
                data-cy="shop-design"
              >
                <div className="relative aspect-[3/4] overflow-hidden bg-subtle">
                  <Photo
                    url={d.images[0].url}
                    alt=""
                    width={480}
                    className="size-full object-cover transition duration-300 group-hover:scale-[1.03]"
                  />
                  {d.images.length > 1 && (
                    <span className="absolute right-2 bottom-2 rounded-full bg-black/60 px-2 py-0.5 text-xs text-white">
                      {d.images.length} photos
                    </span>
                  )}
                </div>
                <div className="px-3 py-2.5">
                  <p className="truncate text-sm font-medium text-fg">{d.name}</p>
                  {d.category && <p className="truncate text-xs text-fg-subtle">{d.category}</p>}
                  <p className={cn("mt-1 text-sm", price ? "font-semibold text-fg" : "text-fg-subtle")}>
                    {price ?? "Ask for price"}
                  </p>
                </div>
              </button>
            </li>
          );
        })}
      </ul>
      {open && (
        <DesignViewer
          design={open}
          business={business}
          bookingOpen={bookingOpen}
          onClose={() => setOpenId(null)}
          onBook={() => {
            setOpenId(null);
            onBook(open);
          }}
        />
      )}
    </section>
  );
}

/** One design in full: every picture, the price, the description, and ways to ask about it. */
function DesignViewer({
  design,
  business,
  bookingOpen,
  onClose,
  onBook,
}: {
  design: PublicDesign;
  business: PublicBusiness;
  bookingOpen: boolean;
  onClose: () => void;
  onBook: () => void;
}) {
  const [index, setIndex] = useState(0);
  const price = formatPriceRange(design.priceMin, design.priceMax, business.currency);
  const picture = design.images[index] ?? design.images[0];
  const message = `Hello ${business.name}, I'm interested in "${design.name}"${price ? ` (${price})` : ""} from your page. ${window.location.href}`;

  return (
    <Modal
      open
      onClose={onClose}
      title={design.name}
      size="lg"
      footer={
        <>
          {bookingOpen && (
            <Button variant="secondary" onClick={onBook} data-cy="shop-design-book">
              Book a fitting
            </Button>
          )}
          {business.phone ? (
            <a
              href={whatsappLink(message, business.phone)}
              target="_blank"
              rel="noreferrer"
              className={buttonClass("primary")}
              data-cy="shop-design-whatsapp"
            >
              <MessageCircle className="size-4" aria-hidden /> Ask about this on WhatsApp
            </a>
          ) : business.email ? (
            <a
              href={`mailto:${business.email}?subject=${encodeURIComponent(design.name)}&body=${encodeURIComponent(message)}`}
              className={buttonClass("primary")}
            >
              <Mail className="size-4" aria-hidden /> Ask about this
            </a>
          ) : null}
        </>
      }
    >
      <div className="space-y-4">
        <div className="overflow-hidden rounded-xl bg-subtle">
          <Photo
            key={picture.url}
            url={picture.url}
            alt={design.name}
            width={1000}
            className="mx-auto max-h-[60dvh] w-full object-contain"
          />
        </div>
        {design.images.length > 1 && (
          <ul className="flex gap-2 overflow-x-auto pb-1" aria-label="Pictures of this design">
            {design.images.map((img, i) => (
              <li key={img.url} className="shrink-0">
                <button
                  type="button"
                  onClick={() => setIndex(i)}
                  aria-label={`Picture ${i + 1} of ${design.images.length}`}
                  aria-current={i === index}
                  className={cn(
                    "block size-16 overflow-hidden rounded-lg border-2 bg-subtle",
                    i === index ? "border-brand" : "border-transparent hover:border-line-strong",
                  )}
                >
                  <Photo url={img.url} alt="" width={160} className="size-full object-cover" />
                </button>
              </li>
            ))}
          </ul>
        )}
        <div>
          <p className="text-lg font-semibold text-fg" data-cy="shop-design-price">
            {price ?? "Ask for price"}
          </p>
          {design.category && <p className="text-sm text-fg-subtle">{design.category}</p>}
          {design.description && <p className="mt-3 text-sm whitespace-pre-line text-fg-muted">{design.description}</p>}
        </div>
      </div>
    </Modal>
  );
}
