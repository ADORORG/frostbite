import { uuidV7TextSchema } from "@ador/shared/identifiers";
import { z } from "zod";

// The wallet sign-in and account-method routes, as contracts: their addresses, and the shapes of what crosses them.
// The public ones (challenge and verify for signing in) need no session; the rest need one. Failures are told in
// as few ways as possible: nothing here says whose wallet a conflicting one is.
export const walletAuthRoutes = {
  beginSignIn: {
    method: "POST",
    operationId: "beginWalletSignIn",
    path: "/api/v1/auth/wallet/challenge",
  },
  verifySignIn: {
    method: "POST",
    operationId: "verifyWalletSignIn",
    path: "/api/v1/auth/wallet/verify",
  },
  beginLink: {
    method: "POST",
    operationId: "beginWalletLink",
    path: "/api/v1/auth/wallet/link/challenge",
  },
  verifyLink: {
    method: "POST",
    operationId: "verifyWalletLink",
    path: "/api/v1/auth/wallet/link/verify",
  },
  beginStepUp: {
    method: "POST",
    operationId: "beginWalletStepUp",
    path: "/api/v1/auth/wallet/step-up/challenge",
  },
  verifyStepUp: {
    method: "POST",
    operationId: "verifyWalletStepUp",
    path: "/api/v1/auth/wallet/step-up/verify",
  },
  unlink: {
    method: "POST",
    operationId: "unlinkWallet",
    path: "/api/v1/auth/wallet/unlink",
  },
  methods: {
    method: "GET",
    operationId: "listAuthMethods",
    path: "/api/v1/auth/methods",
  },
  signOut: {
    method: "POST",
    operationId: "signOut",
    path: "/api/v1/auth/sign-out",
  },
} as const;

// The path the signed message names as the page asking for it (the origin comes from the platform's own address).
export const walletAuthUriPath = "/auth/wallet";

export const walletNetworkSchema = z.enum(["mainnet", "signet"]);

export const walletChallengeRequestSchema = z.strictObject({
  address: z.string().regex(/^[A-Za-z0-9]{14,90}$/u),
  network: walletNetworkSchema,
  // Which wallet software the address came from (named by the connection library), kept with the identity.
  walletAdapter: z.string().regex(/^[A-Za-z0-9_-]{1,64}$/u),
});

export const walletChallengeResponseSchema = z.strictObject({
  challengeId: uuidV7TextSchema,
  expiresAt: z.iso.datetime(),
  message: z.string().min(1).max(4_096),
  signatureScheme: z.literal("bip322-simple"),
});

export const walletVerifyRequestSchema = z.strictObject({
  challengeId: uuidV7TextSchema,
  signature: z.string().min(1).max(4_096),
});

export const walletSignedInResponseSchema = z.strictObject({
  signedIn: z.literal(true),
});
export const walletChangedResponseSchema = z.strictObject({
  changed: z.literal(true),
});
export const walletEmptyRequestSchema = z.strictObject({});

export const walletUnlinkRequestSchema = z.strictObject({
  walletId: uuidV7TextSchema,
});

export const authMethodsResponseSchema = z.strictObject({
  passkeys: z.array(z.strictObject({ credentialId: z.string().min(1) })),
  // Whether the session signed in recently enough to remove a method now; if not, the wallet must sign again.
  recentAuthentication: z.boolean(),
  wallets: z.array(
    z.strictObject({
      address: z.string().min(1),
      id: uuidV7TextSchema,
      linkedAt: z.iso.datetime(),
      network: walletNetworkSchema,
      walletAdapter: z.string().min(1),
    }),
  ),
});

export type WalletChallengeRequest = z.infer<
  typeof walletChallengeRequestSchema
>;
export type WalletChallengeResponse = z.infer<
  typeof walletChallengeResponseSchema
>;
export type WalletVerifyRequest = z.infer<typeof walletVerifyRequestSchema>;
export type WalletUnlinkRequest = z.infer<typeof walletUnlinkRequestSchema>;
export type AuthMethodsResponse = z.infer<typeof authMethodsResponseSchema>;
