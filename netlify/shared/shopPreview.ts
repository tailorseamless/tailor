/**
 * Link previews for a tailor's public page.
 *
 * The web app is a single-page app: the HTML every address returns is the same empty shell, and the page's
 * content is drawn by JavaScript. The programs that build a link preview when someone pastes a link into
 * WhatsApp, Facebook, Telegram or iMessage never run that JavaScript, so without help every tailor's link
 * would preview as "Tailor Seamless". The edge function (`../edge-functions/shop-preview.ts`) uses these
 * functions to give those programs a copy of the shell with this shop's name, price range and photo in its
 * `<head>`. People still get the normal app.
 *
 * Plain functions with no platform calls, so they run (and are tested) anywhere.
 */

/** What the preview needs from `GET /public/businesses/:slug`. */
export interface ShopPagePayload {
  business: { name: string; phone: string | null; address: string | null; currency: string };
  designs: {
    name: string;
    priceMin: number | null;
    priceMax: number | null;
    images: { url: string }[];
  }[];
}

export interface ShopPreview {
  title: string;
  description: string;
  url: string;
  image: string;
  imageAlt: string | null;
  /** A real photo (a wide card) rather than the app icon (a small one). */
  hasPhoto: boolean;
}

/** `/ade-couture` or `/book/ade-couture` → `ade-couture`. Anything else (`/orders/12`, `/sw.js`) → null. */
export function shopSlugFromPath(pathname: string): string | null {
  const match = /^\/(?:book\/)?([a-z0-9][a-z0-9-]{1,58}[a-z0-9])\/?$/.exec(pathname);
  return match ? match[1] : null;
}

/** The link-preview fetchers of the apps people share links in. Real browsers are never matched. */
const PREVIEW_BOTS =
  /whatsapp|facebookexternalhit|facebot|twitterbot|telegrambot|slackbot|slack-imgproxy|linkedinbot|discordbot|skypeuripreview|pinterest|embedly|vkshare|redditbot|applebot|googlebot|bingbot|bingpreview|viber/i;

export const isLinkPreviewBot = (userAgent: string | null): boolean => !!userAgent && PREVIEW_BOTS.test(userAgent);

export function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function money(amount: number, currency: string): string {
  try {
    return new Intl.NumberFormat("en-NG", { style: "currency", currency, maximumFractionDigits: 0 }).format(amount);
  } catch {
    return `${currency} ${Math.round(amount)}`;
  }
}

/** A wide, small JPEG of a Cloudinary photo: the shape and size chat apps want. Other addresses are used as they are. */
export function previewImage(url: string): string {
  const marker = "/image/upload/";
  const at = url.indexOf(marker);
  if (!url.startsWith("https://res.cloudinary.com/") || at < 0) return url;
  const cut = at + marker.length;
  return `${url.slice(0, cut)}c_fill,g_auto,w_1200,h_630,q_auto:eco,f_jpg/${url.slice(cut)}`;
}

export function buildShopPreview(page: ShopPagePayload, origin: string, pathname: string): ShopPreview {
  const { business } = page;
  // Same rule as the page itself: a design with no picture isn't listed, so it isn't counted.
  const shown = page.designs.filter((design) => design.images.length > 0);
  const lowest = shown
    .map((design) => design.priceMin ?? design.priceMax)
    .filter((price): price is number => price !== null)
    .reduce<number | null>((least, price) => (least === null || price < least ? price : least), null);

  const parts: string[] = [];
  if (shown.length) {
    parts.push(
      `${shown.length} design${shown.length === 1 ? "" : "s"}${lowest !== null ? ` from ${money(lowest, business.currency)}` : ""}`,
    );
  } else {
    parts.push("Get in touch to talk about what you'd like made");
  }
  if (business.address) parts.push(business.address);
  else if (business.phone) parts.push(business.phone);

  const cover = shown[0];
  return {
    title: `${business.name} · Designs and prices`,
    description: parts.join(" · ").slice(0, 200),
    url: `${origin}${pathname}`,
    image: cover ? previewImage(cover.images[0].url) : `${origin}/icons/icon-512.png`,
    imageAlt: cover ? cover.name : null,
    hasPhoto: Boolean(cover),
  };
}

/** The site-wide tags in `index.html` that a shop's own must replace, not sit beside. */
const REPLACED_META =
  /<meta\b[^>]*\b(?:name|property)\s*=\s*"(?:description|og:type|og:url|og:title|og:description|og:image|og:image:alt|twitter:[a-z:]+)"[^>]*>\s*/gi;

/** Puts this shop's title and preview tags into the app's HTML. If the HTML has no `<head>`, it is returned as it was. */
export function injectShopPreview(html: string, preview: ShopPreview): string {
  if (!/<\/head>/i.test(html)) return html;
  const e = escapeHtml;
  const tags = [
    `<title>${e(preview.title)}</title>`,
    `<meta name="description" content="${e(preview.description)}" />`,
    `<link rel="canonical" href="${e(preview.url)}" />`,
    `<meta property="og:type" content="website" />`,
    `<meta property="og:url" content="${e(preview.url)}" />`,
    `<meta property="og:title" content="${e(preview.title)}" />`,
    `<meta property="og:description" content="${e(preview.description)}" />`,
    `<meta property="og:image" content="${e(preview.image)}" />`,
    ...(preview.imageAlt ? [`<meta property="og:image:alt" content="${e(preview.imageAlt)}" />`] : []),
    `<meta name="twitter:card" content="${preview.hasPhoto ? "summary_large_image" : "summary"}" />`,
  ];
  return html
    .replace(REPLACED_META, "")
    .replace(/<title>[\s\S]*?<\/title>\s*/i, "")
    .replace(/<link\b[^>]*\brel\s*=\s*"canonical"[^>]*>\s*/gi, "")
    .replace(/<\/head>/i, () => `    ${tags.join("\n    ")}\n  </head>`);
}
