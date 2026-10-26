import {
  manageRolesCapability,
  type AuthorizationPolicy,
} from "@ador/shared/accounts";
import { collectionReviewCapability } from "@ador/shared/collections";
import { gameAdminCapability } from "@ador/shared/games";

// What each of the two working roles may do, written once so the administrator's powers are exactly these and cannot drift from them.
const reviewerCapabilities = [
  "creator:review",
  collectionReviewCapability,
] as const;
// Any staff member may administer a game's rewards contract, including pausing it (ADR-018 Amendment 3); every step is logged.
const staffCapabilities = ["platform:operate", gameAdminCapability] as const;

export const authorizationPolicy = {
  organization: {
    admin: ["organization:members"],
    analyst: ["organization:read"],
    editor: ["organization:edit"],
    owner: ["organization:members", "organization:ownership"],
  },
  platform: {
    // Grants and suspends platform roles, and may do everything staff and reviewers may, so one administrator can run the whole
    // console without also being given the other two roles. (Nobody can review their own collection, whatever they hold.)
    admin: [
      manageRolesCapability,
      ...reviewerCapabilities,
      ...staffCapabilities,
    ],
    reviewer: reviewerCapabilities,
    staff: staffCapabilities,
  },
  // Staff and admin take effect only while the account holds a wallet (ADR-021): they sign chain steps with one, and an email code
  // alone is too weak a way to hold them.
  requiredMethods: { admin: ["wallet"], staff: ["wallet"] },
  version: "beta-v3",
} as const satisfies AuthorizationPolicy;
