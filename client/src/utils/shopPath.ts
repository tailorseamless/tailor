/**
 * A business's public page lives at `/<slug>`, in the same address space as the app's own pages, so those
 * names can't be a business address. The API refuses them too; this copy lets the settings screen say so
 * before saving and build the right link. Keep it in step with `server/src/modules/businesses/domain/shopAddress.ts`.
 */
const RESERVED = new Set([
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
  "capture",
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

export const isReservedSlug = (slug: string): boolean => RESERVED.has(slug.trim().toLowerCase());

/** The path of a business's page. A reserved slug (only possible from before short addresses) keeps `/book/<slug>`. */
export const shopPath = (slug: string): string => (isReservedSlug(slug) ? `/book/${slug}` : `/${slug}`);

/** The full address to copy or share. */
export const shopUrl = (slug: string): string => `${window.location.origin}${shopPath(slug)}`;
