import {
  authMethodsResponseSchema,
  walletAuthRoutes,
  walletChallengeRequestSchema,
  walletChallengeResponseSchema,
  walletChangedResponseSchema,
  walletEmptyRequestSchema,
  walletUnlinkRequestSchema,
  walletVerifyRequestSchema,
  type AuthMethodsResponse,
  type WalletChallengeRequest,
  type WalletChallengeResponse,
  type WalletUnlinkRequest,
  type WalletVerifyRequest,
} from "@ador/auth";
import type { HttpOperation, HttpOperationResult } from "@ador/http";
import { unauthenticated } from "@ador/http/outcome";
import { uuidV7Schema } from "@ador/shared/identifiers";

import {
  issueChallenge,
  recentAuthenticationRequired,
  verificationFailure,
} from "./wallet-results.ts";
import { outcomeFailure } from "./outcomes.ts";
import type { WalletAuthServices } from "./wallet-services.ts";

type Changed = { readonly changed: true };
const signedInErrors = ["unauthorized"] as const;

// The wallet steps of a player who is already signed in: linking another wallet, signing again to prove a recent
// presence, removing a wallet, and seeing what the account signs in with. Every one acts on the session's own
// account, never on one the request names.
export function createWalletMethodsOperations(
  getServices: () => WalletAuthServices,
) {
  function verifyFor(
    action: "link-wallet" | "step-up",
    route: (typeof walletAuthRoutes)["verifyLink" | "verifyStepUp"],
  ) {
    const operation: HttpOperation<WalletVerifyRequest, Changed> = {
      access: { kind: "authenticated" },
      applicationErrors: ["conflict", "unauthorized"],
      execute: async (input, context) => {
        if (context.actorSession === null) return unauthenticated;
        const result = await getServices().auth.verify({
          challengeId: uuidV7Schema.parse(input.challengeId),
          expectedAction: action,
          expectedUserId: context.actorSession.userId,
          signature: input.signature,
        });
        return result.ok
          ? {
              effects: [
                {
                  kind: "replace-platform-session",
                  token: result.sessionToken,
                },
              ],
              ok: true,
              value: { changed: true },
            }
          : verificationFailure(result.code);
      },
      idempotency: "none",
      input: "json",
      inputSchema: walletVerifyRequestSchema,
      outputSchema: walletChangedResponseSchema,
      ...route,
    };
    return operation;
  }
  function beginFor(
    action: "link-wallet" | "step-up",
    route: (typeof walletAuthRoutes)["beginLink" | "beginStepUp"],
  ) {
    const operation: HttpOperation<
      WalletChallengeRequest,
      WalletChallengeResponse
    > = {
      access: { kind: "authenticated" },
      applicationErrors: ["invalid_request", "unauthorized"],
      execute: async (input, context) => {
        if (context.actorSession === null) return unauthenticated;
        const issued = await issueChallenge(
          getServices(),
          input,
          action,
          context.actorSession.userId,
        );
        return issued.ok ? { ok: true, value: issued.value } : issued.failure;
      },
      idempotency: "none",
      input: "json",
      inputSchema: walletChallengeRequestSchema,
      outputSchema: walletChallengeResponseSchema,
      ...route,
    };
    return operation;
  }
  const unlink: HttpOperation<WalletUnlinkRequest, Changed> = {
    access: { kind: "authenticated" },
    applicationErrors: ["conflict", "forbidden", "not_found", "unauthorized"],
    execute: async (input, context): Promise<HttpOperationResult<Changed>> => {
      if (context.actorSession === null) return unauthenticated;
      const result = await getServices().methods.unlink({
        correlationId: context.correlationId,
        session: context.actorSession,
        walletId: uuidV7Schema.parse(input.walletId),
      });
      if (result.ok)
        return {
          effects: [
            { kind: "replace-platform-session", token: result.sessionToken },
          ],
          ok: true,
          value: { changed: true },
        };
      switch (result.code) {
        case "final-method":
          return outcomeFailure("last-sign-in-method");
        case "missing":
          return outcomeFailure("wallet-missing");
        case "recent-authentication-required":
          return recentAuthenticationRequired;
      }
    },
    idempotency: "none",
    input: "json",
    inputSchema: walletUnlinkRequestSchema,
    outputSchema: walletChangedResponseSchema,
    ...walletAuthRoutes.unlink,
  };
  const methods: HttpOperation<Record<string, never>, AuthMethodsResponse> = {
    access: { kind: "authenticated" },
    applicationErrors: signedInErrors,
    execute: async (_input, context) => {
      const session = context.actorSession;
      if (session === null) return unauthenticated;
      const services = getServices();
      const [wallets, passkeys] = await Promise.all([
        services.methods.list(session.userId),
        services.passkeys.list(session.userId),
      ]);
      const age = Date.now() - session.authenticatedAt.getTime();
      return {
        ok: true,
        value: {
          passkeys: passkeys.map((credentialId) => ({ credentialId })),
          recentAuthentication:
            age >= 0 && age <= services.recentAuthenticationWindowMs,
          wallets: wallets.map(
            ({ address, id, linkedAt, network, walletAdapter }) => ({
              address,
              id,
              linkedAt: linkedAt.toISOString(),
              network,
              walletAdapter,
            }),
          ),
        },
      };
    },
    idempotency: "none",
    input: "none",
    inputSchema: walletEmptyRequestSchema,
    outputSchema: authMethodsResponseSchema,
    ...walletAuthRoutes.methods,
    cache: { kind: "revalidate" },
  };
  return [
    beginFor("link-wallet", walletAuthRoutes.beginLink),
    verifyFor("link-wallet", walletAuthRoutes.verifyLink),
    beginFor("step-up", walletAuthRoutes.beginStepUp),
    verifyFor("step-up", walletAuthRoutes.verifyStepUp),
    unlink,
    methods,
  ] as const;
}
