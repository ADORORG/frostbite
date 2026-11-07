import type {
  Address,
  ChainRef,
  ContractRef,
  TransactionState,
  UnsignedTransaction,
} from "@frostbite/shared/chain";

// The neutral transaction states, and `expired` for a claim built and never signed in time.
export type ClaimState = TransactionState | "expired";

// A claim is over when it took effect or never will. Every other state is in progress, and a player has at most one claim
// of a milestone in progress.
export const settledStates: ReadonlySet<ClaimState> = new Set([
  "broadcast_rejected",
  "complete",
  "expired",
  "indexed_failure",
]);

export interface StoredClaim {
  // When the network first gave an id for the claim's transaction; none before it was sent.
  readonly broadcastAt: Date | null;
  readonly chain: ChainRef;
  // The item the claim minted, in the chain's own notation, once the network has shown the transaction included; none before.
  readonly collectibleId: string | null;
  readonly contract: ContractRef;
  readonly createdAt: Date;
  readonly expiresAt: Date;
  // The count the chain's indexed state must show for the wallet before this claim is complete: the wallet's earlier
  // completed claims of the milestone, and this one.
  readonly expectedClaims: number;
  readonly failureReason: string | null;
  readonly gameId: string;
  readonly id: string;
  readonly milestoneId: string;
  // What the platform charges on top of the network fee, in the chain's smallest unit (0: nothing), as it was when the transaction was
  // built: what the wallet was shown is what is kept, whatever the fee is later set to.
  readonly platformFeeSats: bigint;
  readonly signedPayload: string | null;
  readonly state: ClaimState;
  readonly transactionId: string | null;
  // What the wallet was shown and asked to sign.
  readonly unsigned: UnsignedTransaction;
  readonly updatedAt: Date;
  readonly userId: string;
  readonly wallet: Address;
}

export type NewClaim = Pick<
  StoredClaim,
  | "chain"
  | "contract"
  | "createdAt"
  | "expiresAt"
  | "gameId"
  | "id"
  | "milestoneId"
  | "platformFeeSats"
  | "unsigned"
  | "userId"
  | "wallet"
>;

// What a step changes about a claim. The state is always given; the rest only when the step brings it.
export interface ClaimChange {
  readonly collectibleId?: string;
  readonly failureReason?: string;
  readonly signedPayload?: string;
  readonly state: ClaimState;
  readonly transactionId?: string;
}

export type CreateResult =
  | { readonly claim: StoredClaim; readonly kind: "created" }
  | { readonly claim: StoredClaim; readonly kind: "in-progress" }
  | { readonly kind: "limit-reached" };

// Where claims live. `create` does what must not be done in two steps: it lets an unsigned claim that has run out of time
// expire, hands back the claim already in progress if there is one, refuses when the milestone has been claimed as often as
// its policy allows, and otherwise adds the claim, all while no other start for the same player and milestone can interleave.
// `update` finds the player's claim, hands it to `decide` **while holding its row**, and stores the change `decide` returns
// (none: nothing is written), so two steps on one claim never overwrite each other.
export interface GameClaimRepository {
  create(
    claim: NewClaim,
    options: { readonly limit: number },
  ): Promise<CreateResult>;
  get(userId: string, claimId: string): Promise<StoredClaim | null>;
  list(userId: string, gameId: string): Promise<readonly StoredClaim[]>;
  // Every claim of the player's that the network's records show complete, in any game, the most recently completed first.
  listComplete(userId: string): Promise<readonly StoredClaim[]>;
  update(
    userId: string,
    claimId: string,
    decide: (claim: StoredClaim) => ClaimChange | null,
  ): Promise<StoredClaim | null>;
}
