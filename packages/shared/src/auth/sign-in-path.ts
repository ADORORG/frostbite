// Where a signed-out visitor is sent to sign in, and where they go afterwards. The return path comes from the address bar, so it is
// untrusted: only a path on this site is ever followed, never another site, a script, or the sign-in page itself (which would loop).

export const signInPath = "/sign-in";
export const returnToParameter = "returnTo";

const longestReturnPath = 512;
// A stand-in origin for resolving a path; a path that resolves to any other origin was not a plain path on this site.
const base = "https://this-site.invalid";
// Pages a person is never sent back to: the sign-in page, the API, and the local stack's stand-in sign-in.
const neverReturnedTo = [signInPath, "/api", "/dev"];

function isNeverReturnedTo(pathname: string): boolean {
  return neverReturnedTo.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`),
  );
}

// The path to go to after signing in: `raw` if it is a plain path on this site (with its query, without a fragment), otherwise the
// home page. Rejects anything that could leave the site or run code: other schemes, `//host`, backslashes, control characters and
// spaces, over-long values, and pages that are never a destination.
export function safeReturnPath(raw: string | null | undefined): string {
  if (typeof raw !== "string" || raw.length === 0) return "/";
  if (raw.length > longestReturnPath) return "/";
  if (!raw.startsWith("/")) return "/";
  // eslint-disable-next-line no-control-regex -- control characters are exactly what is refused here
  if (/[\\\s\u0000-\u001f\u007f]/u.test(raw)) return "/";
  let resolved: URL;
  try {
    resolved = new URL(raw, base);
  } catch {
    return "/";
  }
  if (resolved.origin !== base) return "/";
  // Dot segments can leave a path that begins with two slashes ("/.//host"), which a browser reads as another site.
  if (resolved.pathname.startsWith("//")) return "/";
  if (isNeverReturnedTo(resolved.pathname)) return "/";
  return `${resolved.pathname}${resolved.search}`;
}

// The sign-in page's address for a visit to `returnTo`; the plain page when there is nowhere in particular to come back to.
export function signInHref(returnTo: string): string {
  const safe = safeReturnPath(returnTo);
  return safe === "/"
    ? signInPath
    : `${signInPath}?${returnToParameter}=${encodeURIComponent(safe)}`;
}

// Where to go after signing in, from the sign-in page's own query string (`window.location.search`).
export function returnTarget(search: string): string {
  return safeReturnPath(new URLSearchParams(search).get(returnToParameter));
}
