/**
 * The server calls an Ollama address that an admin typed, so the address is checked first (SSRF guard):
 * no credentials in it, https only and no private-network hosts in production.
 */
export const OLLAMA_CLOUD = "https://ollama.com";

const PRIVATE_HOST =
  /^(localhost|.*\.local|.*\.internal|.*\.localhost|0\.0\.0\.0|127\.|10\.|192\.168\.|169\.254\.|100\.(6[4-9]|[7-9]\d|1[01]\d|12[0-7])\.|172\.(1[6-9]|2\d|3[01])\.|\[?::1?\]?$|\[?::ffff:|\[?f[cd][0-9a-f]{2}:|\[?fe80:)/i;

export function checkServerAddress(raw: string, allowPrivate: boolean): { url: string } | { problem: string } {
  let url: URL;
  try {
    url = new URL(raw.trim());
  } catch {
    return { problem: "Enter a full address, such as https://ollama.com" };
  }
  if (url.protocol !== "https:" && url.protocol !== "http:") return { problem: "The address must start with https://" };
  if (url.username || url.password) return { problem: "Leave the user name and password out of the address" };
  if (!allowPrivate) {
    if (url.protocol !== "https:") return { problem: "The address must start with https://" };
    if (PRIVATE_HOST.test(url.hostname))
      return { problem: "That address is on a private network and can't be reached" };
  }
  return { url: `${url.origin}${url.pathname.replace(/\/+$/, "")}` };
}
