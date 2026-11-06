import type { CorrelationId } from "@frostbite/shared/http";
import type { UuidV7 } from "@frostbite/shared/identifiers";

import type { ActiveSession } from "../application/session-repository.ts";
import {
  createSessionMaterial,
  type SessionLifetimes,
} from "../application/session-material.ts";
import { createOpaqueValue } from "../domain/crypto.ts";
import type { WalletMethodsRepository } from "./repository.ts";

const SESSION_TOKEN_BYTES = 32;

export interface WalletMethodsPolicy extends SessionLifetimes {
  // How recently the session must have signed in (or stepped up) to remove a wallet.
  readonly recentAuthenticationWindowMs: number;
  // How long a removed wallet cannot be taken by another account.
  readonly releaseHoldMs: number;
}

export type UnlinkWalletOutcome =
  | { readonly ok: true; readonly sessionToken: string }
  | {
      readonly code:
        "final-method" | "missing" | "recent-authentication-required";
      readonly ok: false;
    };

// The wallets of an account and the removal of one. The rules (a recent session, never the last way in, a hold on
// the removed wallet, every other session signed out) are enforced here and in the repository's transaction, not
// by the page that asks.
export function createWalletMethodsService(dependencies: {
  readonly clock: () => Date;
  readonly policy: WalletMethodsPolicy;
  readonly repository: WalletMethodsRepository;
}) {
  const { clock, policy, repository } = dependencies;
  if (
    policy.recentAuthenticationWindowMs <= 0 ||
    policy.releaseHoldMs <= 0 ||
    policy.sessionIdleLifetimeMs <= 0 ||
    policy.sessionAbsoluteLifetimeMs < policy.sessionIdleLifetimeMs
  )
    throw new Error("Wallet methods policy is invalid");
  return {
    list: (userId: UuidV7) => repository.list(userId),
    async unlink(input: {
      readonly correlationId: CorrelationId;
      readonly session: ActiveSession;
      readonly walletId: UuidV7;
    }): Promise<UnlinkWalletOutcome> {
      const now = clock();
      const age = now.getTime() - input.session.authenticatedAt.getTime();
      if (age < 0 || age > policy.recentAuthenticationWindowMs)
        return { code: "recent-authentication-required", ok: false };
      const sessionToken = createOpaqueValue(SESSION_TOKEN_BYTES);
      const result = await repository.unlink({
        correlationId: input.correlationId,
        heldUntil: new Date(now.getTime() + policy.releaseHoldMs),
        minimumAuthenticatedAt: new Date(
          now.getTime() - policy.recentAuthenticationWindowMs,
        ),
        now,
        replacementSession: createSessionMaterial(now, sessionToken, policy),
        sessionId: input.session.sessionId,
        userId: input.session.userId,
        walletId: input.walletId,
      });
      return result.kind === "unlinked"
        ? { ok: true, sessionToken }
        : { code: result.kind, ok: false };
    },
  };
}
