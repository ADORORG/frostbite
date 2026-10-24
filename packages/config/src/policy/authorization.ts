import {
  manageRolesCapability,
  type AuthorizationPolicy,
} from "@ador/shared/accounts";
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
    // Grants and suspends platform roles; does not by itself operate the platform (a person may hold both roles).
    admin: [manageRolesCapability],
    reviewer: ["creator:review", collectionReviewCapability],
    // Any staff member may administer a game's rewards contract, including pausing it (ADR-018 Amendment 3); every step is logged.
    staff: ["platform:operate", gameAdminCapability],
  },
  // Staff and admin take effect only while the account holds a wallet (ADR-021): they sign chain steps with one, and an email code
  // alone is too weak a way to hold them.
  requiredMethods: { admin: ["wallet"], staff: ["wallet"] },
  version: "beta-v2",
} as const satisfies AuthorizationPolicy;
