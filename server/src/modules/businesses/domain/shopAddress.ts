/**
 * The public address of a business's page: `<APP_URL>/<slug>`. The slug shares the address space with the
 * app's own pages (`/orders`, `/settings`…), so those names — and a few others that would confuse visitors
 * or clash with files the site serves — can never be a business address.
 *
 * Keep this list in step with `client/src/utils/shopPath.ts`, which uses it to build links without a round trip.
 */
export const RESERVED_SLUGS: ReadonlySet<string> = new Set([
  // The app's own pages and routes.
  "sign-in",
  "portal",
  "book",
  "dashboard",
  "customers",
  "orders",
  "appointments",
  "appointment-requests",
  "tasks",
  "designs",
  "inventory",
  "expenses",
  "reports",
  "team",
  "admin",
  "notifications",
  "settings",
  // Things a visitor expects to be the site itself, not one tailor.
  "api",
  "app",
  "www",
  "assets",
  "static",
  "public",
  "icons",
  "images",
  "favicon",
  "manifest",
  "offline",
  "robots",
  "sitemap",
  "index",
  "login",
  "logout",
  "signin",
  "signup",
  "sign-up",
  "register",
  "account",
  "auth",
  "billing",
  "pricing",
  "help",
  "support",
  "about",
  "contact",
  "terms",
  "privacy",
  "status",
  "blog",
  "docs",
  "shop",
  "shops",
  "null",
  "undefined",
  "tailor-seamless",
  "tailorseamless",
]);

export const isReservedSlug = (slug: string): boolean => RESERVED_SLUGS.has(slug.toLowerCase());

/**
 * A starting address made from the business name ("Adé Stitches" → "ade-stitches"), for publishing a page
 * without asking the owner to invent one. Null when the name leaves too little to use. Short enough to take
 * a "-2" style ending and stay within 60 characters.
 */
export function slugFromName(name: string): string | null {
  const slug = name
    .normalize("NFKD")
    .replace(/\p{M}/gu, "") // accents and tone marks
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+/, "")
    .slice(0, 50)
    .replace(/-+$/, "");
  return slug.length >= 3 ? slug : null;
}

/**
 * Where a business's page lives. A reserved slug can only exist on a business from before the page had a
 * short address, so it keeps its old `/book/<slug>` link instead of being shadowed by an app page.
 */
export const shopPath = (slug: string): string => (isReservedSlug(slug) ? `/book/${slug}` : `/${slug}`);
