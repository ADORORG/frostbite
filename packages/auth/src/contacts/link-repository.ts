import type { CorrelationId } from "@ador/shared/http";

import type { SessionMaterial } from "../application/repository.ts";
import type { MethodKind } from "../methods/contracts.ts";

// Linking an address to, and removing one from, an account that is already signed in. Both change the account's ways in, so both run in
// one transaction under the account's lock, from a session that is still recent, replace every session of the account, and are audited.
interface Change {
  readonly correlationId: CorrelationId;
  readonly destination: string;
  readonly kind: MethodKind;
  readonly minimumAuthenticatedAt: Date;
  readonly now: Date;
  readonly replacementSession: SessionMaterial;
  readonly sessionId: string;
  readonly userId: string;
}

// An address an account holds and when it was added.
export interface LinkedContact {
  readonly addedAt: Date;
  readonly value: string;
}

export type CompleteLinkResult =
  | { readonly kind: "linked" }
  // The account already holds this address: nothing changes, no session is replaced.
  | { readonly kind: "already-linked" }
  // Another account holds it. Nothing moves and nothing says whose it is (ADR-021 point 5: no merging).
  | { readonly kind: "taken" }
  // The account already holds as many addresses of this kind as it may. The code is spent and nothing is added.
  | { readonly kind: "limit-reached" }
  // The code was used, replaced or expired between the check and the change.
  | { readonly kind: "code-spent" }
  // The session may no longer make the change.
  | { readonly kind: "session-not-recent" };

export type UnlinkContactResult =
  | { readonly kind: "unlinked" }
  // The account would be left with no way to sign in.
  | { readonly kind: "final-method" }
  // No such address on this account.
  | { readonly kind: "missing" }
  | { readonly kind: "session-not-recent" };

export interface ContactLinkRepository {
  // Spends the code and adds the address to the account, unless another account holds it (then the code is spent and nothing is added).
  // `maximumAddresses` is the most of this kind one account may hold; it is counted in the same transaction, under the account's lock, so
  // addresses added at once from different sessions cannot go past it.
  completeLink(
    input: Change & {
      readonly codeId: string;
      readonly maximumAddresses: number;
    },
  ): Promise<CompleteLinkResult>;
  // The account's addresses of this kind, the oldest first.
  list(userId: string, kind: MethodKind): Promise<readonly LinkedContact[]>;
  unlink(input: Change): Promise<UnlinkContactResult>;
}
