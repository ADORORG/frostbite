import type { ChainPorts } from "@ador/chain/ports";
import type {
  Address,
  ChainRef,
  ContractRef,
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
  // Whether the milestone is on the player's account as earned, at any level.
  earned(userId: string, gameId: string, milestoneId: string): Promise<boolean>;
  funding(chain: ChainRef): FundingPolicy;
  game(gameId: string): Promise<ClaimableGame | null>;
  newId(): string;
  ports(chain: ChainRef): ClaimChainPorts | null;
  readonly repository: GameClaimRepository;
}

// A claim as a person or a page is told of it. The transaction to sign is given only while the wallet is still to be asked.
export interface ClaimView {
  readonly expiresAt: string;
  readonly failureReason: string | null;
  readonly gameId: string;
  readonly id: string;
  readonly milestoneId: string;
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
        | "limit-reached"
        | "not-claimable"
        | "not-earned"
        | "unavailable"
        | "wrong-chain";
      readonly ok: false;
    }
  | {
      readonly code: "would-fail";
      readonly ok: false;
      readonly reason: string;
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
