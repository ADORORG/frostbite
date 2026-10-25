import type { SetupLinkService } from "@ador/authorization";
import type { HttpOperation } from "@ador/http";
import { failure, unauthenticated } from "@ador/http/outcome";

import {
  redeemSetupLinkRequestSchema,
  redeemSetupLinkResponseSchema,
  setupLinkRoutes,
  type RedeemSetupLinkRequest,
  type RedeemSetupLinkResponse,
} from "./contract.ts";

// One answer for a link that is unknown, expired, replaced or spent, so a caller learns nothing about which it was.
const invalidLink = failure(
  "not_found",
  "This setup link is not valid, or it has expired.",
);

// Opening a setup link while signed in. The account that becomes administrator is the session's own, never one the request names.
export function createRedeemSetupLinkOperation(
  getService: () => Pick<SetupLinkService, "redeem">,
): HttpOperation<RedeemSetupLinkRequest, RedeemSetupLinkResponse> {
  return {
    access: { kind: "authenticated" },
    applicationErrors: ["conflict", "not_found", "unauthorized"],
    execute: async (input, context) => {
      if (context.actorSession === null) return unauthenticated;
      const result = await getService().redeem({
        correlationId: context.correlationId,
        token: input.token,
        userId: context.actorSession.userId,
      });
      switch (result.kind) {
        case "granted":
        case "already-used-by-you":
          return { ok: true, value: { status: result.kind } };
        case "needs-method":
          return failure(
            "conflict",
            `Add a ${result.missing.join(" and ")} sign-in method to this account first, then open the link again.`,
          );
        case "invalid-link":
          return invalidLink;
      }
    },
    idempotency: "none",
    input: "json",
    inputSchema: redeemSetupLinkRequestSchema,
    outputSchema: redeemSetupLinkResponseSchema,
    ...setupLinkRoutes.redeem,
  };
}
