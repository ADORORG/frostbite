import type { SetupLinkService } from "@frostbite/authorization";
import type { HttpOperation } from "@frostbite/http";
import { unauthenticated } from "@frostbite/http/outcome";

import { outcomeFailure } from "../application/outcomes.ts";

import {
  redeemSetupLinkRequestSchema,
  redeemSetupLinkResponseSchema,
  setupLinkRoutes,
  type RedeemSetupLinkRequest,
  type RedeemSetupLinkResponse,
} from "./contract.ts";

// One answer for a link that is unknown, expired, replaced or spent, so a caller learns nothing about which it was.
const invalidLink = outcomeFailure("setup-link-invalid");

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
          return outcomeFailure(
            "setup-method-needed",
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
