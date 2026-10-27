// How long and where a read's answer may be kept by the browser. Every read states one (see `registerHttpOperation`), so a
// forgotten policy is a failure at start-up, not a quiet default.
//
// - `no-store`: the answer is never kept (what changes under the reader's feet, or is secret).
// - `revalidate`: the answer may be kept, but is asked about every time: the platform answers "unchanged" (304) without sending it
//   again. Safe for anything that depends on who is signed in, because the platform still checks who is asking.
// - `max-age`: the answer may be reused for that many seconds without asking. For what cannot change, or may be stale.
export type HttpCachePolicy =
  | { readonly kind: "max-age"; readonly seconds: number }
  | { readonly kind: "no-store" }
  | { readonly kind: "revalidate" };

// A year: the longest a browser is asked to keep anything (RFC 9111 §5.2.2.1 lets caches treat more as this).
export const maxCacheSeconds = 31_536_000;

export function cacheControl(
  policy: HttpCachePolicy,
  scope: "private" | "public",
): string {
  switch (policy.kind) {
    case "no-store":
      return "no-store";
    case "revalidate":
      return `${scope}, no-cache`;
    case "max-age":
      return `${scope}, max-age=${String(policy.seconds)}`;
  }
}

export function assertCachePolicy(policy: HttpCachePolicy): void {
  if (
    policy.kind === "max-age" &&
    !(
      Number.isInteger(policy.seconds) &&
      policy.seconds > 0 &&
      policy.seconds <= maxCacheSeconds
    )
  )
    throw new Error(
      `A cache lifetime is a whole number of seconds from 1 to ${String(maxCacheSeconds)}.`,
    );
}
