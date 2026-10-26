import type { SessionState } from "@ador/feature-accounts/widget";

import type { PageAccessDependencies } from "./page-access.ts";
import { resolvePageAccess } from "./page-access.ts";

// Whether anyone is signed in under this request's session cookie, for the header. A session that cannot be read is `unknown`, which
// the header shows as neither signed in nor out, rather than a sign-in link to someone who may be signed in.
export async function readSessionState(
  token: string | undefined,
  getDependencies: () => PageAccessDependencies,
): Promise<SessionState> {
  const access = await resolvePageAccess(
    { kind: "authenticated" },
    token,
    getDependencies,
  );
  switch (access.kind) {
    case "allowed":
      return "signed-in";
    case "unauthenticated":
      return "signed-out";
    case "forbidden":
    case "unavailable":
      return "unknown";
  }
}
