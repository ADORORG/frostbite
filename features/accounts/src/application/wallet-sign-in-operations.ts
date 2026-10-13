import {
  walletAuthRoutes,
  walletChallengeRequestSchema,
  walletChallengeResponseSchema,
  walletChangedResponseSchema,
  walletEmptyRequestSchema,
  walletSignedInResponseSchema,
  walletVerifyRequestSchema,
  type WalletChallengeRequest,
  type WalletChallengeResponse,
  type WalletVerifyRequest,
} from "@ador/auth";
import type { HttpOperation } from "@ador/http";
import { unauthenticated } from "@ador/http/outcome";
import { uuidV7Schema } from "@ador/shared/identifiers";

import { issueChallenge, verificationFailure } from "./wallet-results.ts";
import type { WalletAuthServices } from "./wallet-services.ts";

// Signing in with a wallet, and signing out. Both of the sign-in steps are open to anyone (there is no session
// yet); the second one starts the session, and its token reaches the browser only as a cookie.
export function createWalletSignInOperations(
  getServices: () => WalletAuthServices,
) {
  const begin: HttpOperation<WalletChallengeRequest, WalletChallengeResponse> =
    {
      access: { kind: "public" },
      applicationErrors: ["invalid_request"],
      execute: async (input) => {
        const issued = await issueChallenge(getServices(), input, "sign-in");
        return issued.ok ? { ok: true, value: issued.value } : issued.failure;
      },
      idempotency: "none",
      input: "json",
      inputSchema: walletChallengeRequestSchema,
      outputSchema: walletChallengeResponseSchema,
      ...walletAuthRoutes.beginSignIn,
    };
  const verify: HttpOperation<
    WalletVerifyRequest,
    { readonly signedIn: true }
  > = {
    access: { kind: "public" },
    applicationErrors: ["conflict", "unauthorized"],
    execute: async (input) => {
      const result = await getServices().auth.verify({
        challengeId: uuidV7Schema.parse(input.challengeId),
        expectedAction: "sign-in",
        signature: input.signature,
      });
      return result.ok
        ? {
            effects: [
              { kind: "replace-platform-session", token: result.sessionToken },
            ],
            ok: true,
            value: { signedIn: true },
          }
        : verificationFailure(result.code);
    },
    idempotency: "none",
    input: "json",
    inputSchema: walletVerifyRequestSchema,
    outputSchema: walletSignedInResponseSchema,
    ...walletAuthRoutes.verifySignIn,
  };
  const signOut: HttpOperation<
    Record<string, never>,
    { readonly changed: true }
  > = {
    access: { kind: "authenticated" },
    applicationErrors: ["unauthorized"],
    execute: async (_input, context) => {
      if (context.actorSession === null) return unauthenticated;
      // Only this session ends; the player's other browsers stay signed in. The cookie goes whether or not the
      // session was still there to revoke, so the browser is signed out either way.
      await getServices().sessions.revokeSession(context.actorSession);
      return {
        effects: [{ kind: "clear-platform-session" }],
        ok: true,
        value: { changed: true },
      };
    },
    idempotency: "none",
    input: "json",
    inputSchema: walletEmptyRequestSchema,
    outputSchema: walletChangedResponseSchema,
    ...walletAuthRoutes.signOut,
  };
  return [begin, verify, signOut] as const;
}
