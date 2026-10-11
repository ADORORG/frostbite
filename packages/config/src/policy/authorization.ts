import type { AuthorizationPolicy } from "@ador/shared/accounts";
import { collectionReviewCapability } from "@ador/shared/collections";

export const authorizationPolicy = {
  organization: {
    admin: ["organization:members"],
    analyst: ["organization:read"],
    editor: ["organization:edit"],
    owner: ["organization:members", "organization:ownership"],
  },
  platform: {
    reviewer: ["creator:review", collectionReviewCapability],
    staff: ["platform:operate"],
  },
  version: "beta-v1",
} as const satisfies AuthorizationPolicy;
