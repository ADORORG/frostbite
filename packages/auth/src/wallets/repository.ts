import type { WalletNetwork } from "@ador/shared/chain";
import type { UuidV7 } from "@ador/shared/identifiers";
import type { CorrelationId } from "@ador/shared/http";

import type { SessionMaterial } from "../application/repository.ts";

// A wallet linked to an account, as the account's owner may see it.
export interface LinkedWallet {
  readonly address: string;
  readonly id: UuidV7;
  readonly linkedAt: Date;
  readonly network: WalletNetwork;
  readonly walletAdapter: string;
}

export type UnlinkWalletResult =
  | { readonly kind: "unlinked" }
  // The account would be left with no way to sign in.
  | { readonly kind: "final-method" }
  // No such wallet on this account, or the session may no longer make the change.
  | { readonly kind: "missing" };

export interface WalletMethodsRepository {
  list(userId: UuidV7): Promise<readonly LinkedWallet[]>;
  // Removes one wallet from the account in one transaction: under the account's lock, from a session that is still
  // recent, only if another method can still sign in; holds the wallet until `heldUntil`, signs every session of
  // the account out, starts the replacement session and records the change.
  unlink(input: {
    readonly correlationId: CorrelationId;
    readonly heldUntil: Date;
    readonly minimumAuthenticatedAt: Date;
    readonly now: Date;
    readonly replacementSession: SessionMaterial;
    readonly sessionId: UuidV7;
    readonly userId: UuidV7;
    readonly walletId: UuidV7;
  }): Promise<UnlinkWalletResult>;
}
