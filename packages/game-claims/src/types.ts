import type { ChainPorts } from "@ador/chain/ports";
import type {
  Address,
  ChainRef,
  ContractRef,
  DelayPolicy,
  FundingPolicy,
  TransactionSummary,
  UnsignedTransaction,
} from "@ador/shared/chain";

import type { GameClaimRepository, StoredClaim } from "./repository.ts";

// What the service knows of a game, and nothing game-specific: the chain it is on, the rewards contract deployed for it (none
// until one is), and the most times one player may claim each of its milestones (from the manifest's claim policy).
export interface ClaimableGame {
  readonly chain: ChainRef;
  readonly contract: ContractRef | null;
  readonly limits: ReadonlyMap<string, number>;
}

// The chain ports a claim uses, and nothing else.
export type ClaimChainPorts = Pick<
  ChainPorts,
  | "addressCodec"
  | "broadcaster"
  | "builder"
  | "contracts"
  | "observer"
  | "rewards"
>;

export interface GameClaimsDependencies {
  readonly clock: () => Date;
  // When a claim's wait is called delayed.
  readonly delay: DelayPolicy;
  // Whether the milestone is on the player's account as earned, at any level.
  earned(userId: string, gameId: string, milestoneId: string): Promise<boolean>;
  funding(chain: ChainRef): FundingPolicy;
  game(gameId: string): Promise<ClaimableGame | null>;
  newId(): string;
  ports(chain: ChainRef): ClaimChainPorts | null;
  readonly repository: GameClaimRepository;
  // Told of anything unexpected that stopped a claim from starting (what it was, never the player's address), so an operator can see why
  // a player was only told "try again". Optional: nothing is lost when it is absent, the player is told the same.
  report?(failure: { readonly error: unknown; readonly step: string }): void;
}

// A claim as a person or a page is told of it. The transaction to sign is given only while the wallet is still to be asked.
export interface ClaimView {
  // Sent and waiting longer than expected, or waiting on an indexer that is far behind. Never a statement that the claim failed.
  readonly delayed: boolean;
  readonly expiresAt: string;
  readonly failureReason: string | null;
  readonly gameId: string;
  readonly id: string;
  readonly milestoneId: string;
  // When the claim was sent to the network; none before.
  readonly sentAt: string | null;
  readonly state: StoredClaim["state"];
  readonly summary: TransactionSummary;
  readonly toSign: UnsignedTransaction | null;
  readonly transactionId: string | null;
  readonly wallet: Address;
}

export type StartClaimResult =
  | { readonly claim: ClaimView; readonly ok: true; readonly resumed: boolean }
  | {
      readonly code:
        | "chain-unavailable"
        | "claims-paused"
        | "contract-refused"
        | "fee-too-high"
        | "index-behind"
        | "limit-reached"
        | "milestone-not-defined"
        | "no-funds"
        | "not-claimable"
        | "not-earned"
        | "unavailable"
        | "wrong-chain";
      readonly ok: false;
    };

export type SubmitClaimResult =
  | { readonly claim: ClaimView; readonly ok: true }
  | {
      readonly code:
        | "chain-unavailable"
        | "expired"
        | "not-awaiting-signature"
        | "not-found";
      readonly ok: false;
    }
  | {
      readonly code: "invalid-signature";
      readonly ok: false;
      readonly reason: string;
    };

export type RefreshClaimResult =
  | { readonly claim: ClaimView; readonly ok: true }
  | { readonly code: "chain-unavailable" | "not-found"; readonly ok: false };

// A claim the network's records show complete, as the player's list of what they minted has it.
export interface MintedClaim {
  readonly claimId: string;
  readonly gameId: string;
  readonly milestoneId: string;
  readonly mintedAt: string;
  readonly transactionId: string;
}
