/**
 * "Send me back where I was" after sign-in / sign-up.
 *
 * The page a visitor came from travels as `?next=/path?query` on /login and
 * /signup. Only same-site paths are honoured (never "//evil.com" or a full
 * URL), and the auth pages themselves are skipped so nobody loops back to
 * the form they just used.
 */
const SKIP = ["/login", "/signup", "/forgot-password", "/reset-password", "/api/"];

export function safeReturnTo(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const v = raw.trim();
  // Same-site path only: one leading slash, no protocol-relative "//" and no
  // backslashes (browsers treat "/\evil.com" like "//evil.com").
  if (!v.startsWith("/") || v.startsWith("//") || v.includes("\\")) return null;
  const path = v.split(/[?#]/)[0];
  if (SKIP.some((s) => (s.endsWith("/") ? path.startsWith(s) : path === s || path.startsWith(`${s}/`)))) {
    return null;
  }
  return v;
}

/** `/login` or `/signup` with `?next=` set when there is somewhere to return to. */
export function authHref(base: "/login" | "/signup", next: string | null): string {
  return next ? `${base}?${new URLSearchParams({ next }).toString()}` : base;
}

/**
 * Where a Sign in / Sign up link on the current page should return to: the
 * page itself, or — when already on an auth page — whatever it was carrying.
 */
export function returnToFrom(pathname: string, search: string): string | null {
  return (
    safeReturnTo(`${pathname}${search}`) ??
    safeReturnTo(new URLSearchParams(search).get("next"))
  );
}
