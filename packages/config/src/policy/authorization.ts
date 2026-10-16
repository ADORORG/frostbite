import type { AuthorizationPolicy } from "@ador/shared/accounts";
import { collectionReviewCapability } from "@ador/shared/collections";
import { gameAdminCapability } from "@ador/shared/games";

export const authorizationPolicy = {
  organization: {
    admin: ["organization:members"],
    analyst: ["organization:read"],
    editor: ["organization:edit"],
    owner: ["organization:members", "organization:ownership"],
  },
  platform: {
    reviewer: ["creator:review", collectionReviewCapability],
    // Any staff member may administer a game's rewards contract, including pausing it (ADR-018 Amendment 3); every step is logged.
    staff: ["platform:operate", gameAdminCapability],
  },
  version: "beta-v1",
} as const satisfies AuthorizationPolicy;
