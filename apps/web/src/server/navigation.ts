import type { NavigationContribution } from "@frostbite/shared/features";
import type { UuidV7 } from "@frostbite/shared/identifiers";
import {
  markCurrent,
  navigationForAudience,
  navigationForUser,
  type NavigationItem,
} from "@frostbite/plugin-kit/navigation";

import {
  resolvePageAccess,
  type PageAccessDependencies,
} from "./auth/page-access.ts";

// The links shown on a page. Navigation is a convenience and never authorization: each page still
// checks access itself, and any failure here falls back to what a visitor sees.

export function visitorNavigation(
  contributions: readonly NavigationContribution[],
  path: string,
): readonly NavigationItem[] {
  return markCurrent(navigationForAudience(contributions, "public"), path);
}

export async function actorNavigation(
  contributions: readonly NavigationContribution[],
  path: string,
  actorUserId: UuidV7,
  getDependencies: () => PageAccessDependencies,
): Promise<readonly NavigationItem[]> {
  const items = await navigationForUser(contributions, async (capability) => {
    const decision = await getDependencies().forPlatform({
      capability,
      userId: actorUserId,
    });
    return decision.allowed;
  });
  return markCurrent(items, path);
}

// For pages anyone may open: a signed-in person still sees their own links, so the bar does not change
// when they move between public and private pages.
export async function navigationForSession(
  contributions: readonly NavigationContribution[],
  path: string,
  token: string | undefined,
  getDependencies: () => PageAccessDependencies,
): Promise<readonly NavigationItem[]> {
  const access = await resolvePageAccess(
    { kind: "authenticated" },
    token,
    getDependencies,
  );
  return access.kind === "allowed"
    ? actorNavigation(contributions, path, access.actorUserId, getDependencies)
    : visitorNavigation(contributions, path);
}
