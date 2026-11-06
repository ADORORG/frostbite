import { signInHref } from "@frostbite/shared/auth/sign-in-path";

import type { PageAccessDecision } from "./page-access";

// What a protected page does with the access decision. A visitor who is not signed in is sent to the sign-in page, which brings
// them back here afterwards; being signed in without permission, or the check being unavailable, stays a page that says so, because
// signing in again would not change either.
export type PageOutcome =
  | { readonly kind: "redirect"; readonly to: string }
  | { readonly kind: "render" }
  | { readonly kind: "state"; readonly state: "forbidden" | "unavailable" };

export function pageOutcome(
  decision: PageAccessDecision,
  routePath: string,
): PageOutcome {
  switch (decision.kind) {
    case "allowed":
      return { kind: "render" };
    case "unauthenticated":
      return { kind: "redirect", to: signInHref(routePath) };
    case "forbidden":
    case "unavailable":
      return { kind: "state", state: decision.kind };
  }
}
