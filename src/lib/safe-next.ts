const PLACEHOLDER_ORIGIN = "https://lnpeople.invalid";

/**
 * Only same-site absolute paths are allowed as post-login destinations.
 * Browsers silently drop tabs/newlines and treat "\" like "/", so any whitespace, control character
 * or backslash is rejected outright; the remainder must still resolve to our own origin.
 */
export function safeNext(next: string | null | undefined, fallback = "/home"): string {
  if (!next || !next.startsWith("/") || next.startsWith("//")) return fallback;
  // eslint-disable-next-line no-control-regex
  if (/[\u0000-\u001F\u007F\s\\]/.test(next)) return fallback;
  let url: URL;
  try {
    url = new URL(next, PLACEHOLDER_ORIGIN);
  } catch {
    return fallback;
  }
  if (url.origin !== PLACEHOLDER_ORIGIN) return fallback;
  if (url.pathname === "/login" || url.pathname.startsWith("/login/")) return fallback;
  return `${url.pathname}${url.search}${url.hash}`;
}
