import { z } from "zod";

// The one route of the first-administrator setup (ADR-021): a signed-in person presents the token from their setup link. The token
// travels in the body, never in the address, so it stays out of access logs and referrers.
export const setupLinkRoutes = {
  redeem: {
    method: "POST",
    operationId: "redeemSetupLink",
    path: "/api/v1/auth/setup-link/redeem",
  },
} as const;

export const redeemSetupLinkRequestSchema = z.strictObject({
  token: z.string().min(1).max(256),
});
export type RedeemSetupLinkRequest = z.infer<
  typeof redeemSetupLinkRequestSchema
>;

// Both mean the person is an administrator now; the second is a retry of a request that already succeeded.
export const redeemSetupLinkResponseSchema = z.strictObject({
  status: z.enum(["granted", "already-used-by-you"]),
});
export type RedeemSetupLinkResponse = z.infer<
  typeof redeemSetupLinkResponseSchema
>;
