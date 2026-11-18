import { buildShopPreview, injectShopPreview, isLinkPreviewBot, shopSlugFromPath } from "../shared/shopPreview.ts";
import type { ShopPagePayload } from "../shared/shopPreview.ts";

/** What this file uses of the Netlify edge runtime. */
interface EdgeContext {
  next(): Promise<Response>;
}
declare const Netlify: { env: { get(name: string): string | undefined } };

/** How long a link-preview fetcher is made to wait for the API. They give up after a few seconds anyway. */
const API_TIMEOUT_MS = 4000;

/**
 * `/<shop>` and `/book/<shop>`, only when WhatsApp, Facebook, Telegram… asks (see `shared/shopPreview.ts`).
 * Everyone else — and any failure here — gets the app exactly as before: returning nothing lets the request
 * carry on to the site. The API is only called for those fetchers, so a sleeping API never slows a visitor.
 */
export default async function shopPreview(request: Request, context: EdgeContext): Promise<Response | undefined> {
  if (request.method !== "GET") return;
  const url = new URL(request.url);
  const slug = shopSlugFromPath(url.pathname);
  if (!slug || !isLinkPreviewBot(request.headers.get("user-agent"))) return;

  const api = Netlify.env.get("VITE_API_URL")?.replace(/\/+$/, "");
  if (!api) return;

  try {
    const res = await fetch(`${api}/public/businesses/${slug}`, {
      headers: { accept: "application/json" },
      signal: AbortSignal.timeout(API_TIMEOUT_MS),
    });
    if (!res.ok) return; // not a shop (or not published): the app shows its own "Page not found"
    const { data } = (await res.json()) as { data?: ShopPagePayload };
    if (!data?.business?.name || !Array.isArray(data.designs)) return;

    const shell = await context.next();
    const html = injectShopPreview(await shell.text(), buildShopPreview(data, url.origin, url.pathname));
    const headers = new Headers(shell.headers);
    headers.delete("content-length");
    headers.set("content-type", "text/html; charset=utf-8");
    return new Response(html, { status: shell.status, headers });
  } catch {
    return;
  }
}

export const config = { path: ["/:slug", "/book/:slug"] };
