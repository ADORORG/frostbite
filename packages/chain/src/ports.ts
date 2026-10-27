import type {
  Address,
  Amount,
  AssetRef,
  BlockRef,
  BroadcastOutcome,
  ChainRef,
  CollectiblePreview,
  ChainTransaction,
  ContractInspection,
  ContractRef,
  FeeRate,
  FundingPolicy,
  IndexingStatus,
  Observation,
  SignedTransaction,
  SimulationResult,
  TransactionIntent,
  TransactionRef,
  UnsignedTransaction,
  VerificationResult,
} from "@ador/shared/chain";

// The neutral chain ports (ADR-017 section 3). Each exists because the platform performs the
// operation; there is no generic "call any method" escape hatch. Family concepts (Alkane ids,
// PSBTs, protostones, view-function names) never appear in a signature here.

export class InvalidAddressError extends Error {
  readonly code = "invalid-address";
  constructor(message: string) {
    super(message);
    this.name = "InvalidAddressError";
  }
}

// The chain could not be asked right now: it cannot be reached, or the service that reads it is behind it. Both pass, so the caller tells
// the person to try again; "behind" is told apart because it says what is wrong (the index, not the connection) and cannot be fixed from
// here. Defined with the neutral ports so the services above the adapter can read it without knowing the chain family.
export class ChainUnavailableError extends Error {
  constructor(
    message: string,
    readonly reason: "behind" | "unreachable" = "unreachable",
  ) {
    super(message);
    this.name = "ChainUnavailableError";
  }
}

// Why a transaction could not be built, as a code the caller can act on. It names no chain family, so the services that start a claim or a
// step can tell a wallet with no coins from a fee above the limit from a network that did not answer, without knowing which chain it is.
export class BuildRefusedError extends Error {
  constructor(
    readonly code:
      | "fee-above-limit"
      | "insufficient-funds"
      | "invalid-request"
      | "unsupported-operation",
    message: string,
  ) {
    super(message);
    this.name = "BuildRefusedError";
  }
}

export interface AddressCodec {
  // Returns the canonical address, or throws InvalidAddressError for non-canonical, malformed, or
  // cross-chain input. It never "fixes up" what it was given.
  parse(chain: ChainRef, text: string): Address;
}

export interface ChainReader {
  balances(
    owner: Address,
    assets?: readonly AssetRef[],
  ): Promise<readonly Amount[]>;
  head(chain: ChainRef): Promise<BlockRef>;
  transaction(ref: TransactionRef): Promise<ChainTransaction>;
}

export interface ContractGateway {
  // Chooses where on the chain a new template goes, so staff never type the chain's notation: an address with no contract at it that
  // `taken` (the platform's own record, steps not yet confirmed among them) does not name, or null when none was found in the range the
  // chain's settings allow. Asking again before anything is published may give the same address.
  freeTemplateAddress(
    chain: ChainRef,
    taken: (address: string) => Promise<boolean>,
  ): Promise<string | null>;
  inspect(ref: ContractRef): Promise<ContractInspection>;
  simulate(intent: TransactionIntent): Promise<SimulationResult>;
}

// One transaction a signed payload holds, for a person who follows it on a block explorer. A step that needs two (a commit that pays
// for the data and a reveal that shows it) lists both, in the order they are sent.
export interface TransactionPart {
  readonly id: string;
  readonly role: "commit" | "reveal" | "transaction";
}

export interface TransactionBuilder {
  build(
    intent: TransactionIntent,
    funding: FundingPolicy,
  ): Promise<UnsignedTransaction>;
  // Checks that what the wallet signed is what was built and shown: same chain, family, format,
  // and a payload that still matches the summary the person approved.
  verifySigned(
    unsigned: UnsignedTransaction,
    signed: SignedTransaction,
  ): VerificationResult;
  // The ids of the transactions a signed payload holds, in the order they are sent; none for a payload that is not fully signed.
  transactionIds(signed: SignedTransaction): readonly TransactionPart[];
}

export interface Broadcaster {
  // Broadcasting the same signed transaction twice never yields two different transaction ids.
  broadcast(transaction: SignedTransaction): Promise<BroadcastOutcome>;
}

export interface ChainObserver {
  // Read-only and repeatable: asking again for the same state returns equivalent evidence.
  observe(ref: TransactionRef): Promise<Observation>;
  // How far the chain's indexer has read against the chain's tip. Throws when the chain cannot be asked.
  indexing(chain: ChainRef): Promise<IndexingStatus>;
  // The height of the chain's tip alone, so it can be told when the indexer cannot be asked. Throws when the chain cannot be asked.
  tip(chain: ChainRef): Promise<number>;
  // What the chain's fee market quotes, in satoshis per virtual byte, for confirming within each of `targets` blocks. Throws when the
  // chain cannot be asked or has no quote for a target: a rate is never guessed.
  feeRates(
    chain: ChainRef,
    targets: readonly number[],
  ): Promise<readonly FeeRate[]>;
  // What an address holds on the chain, in its smallest unit: `confirmed` can be spent by a step, `pending` is still waiting for its
  // first confirmation. Throws when the chain cannot be asked.
  balance(chain: ChainRef, address: string): Promise<AddressBalance>;
}

export interface AddressBalance {
  readonly confirmed: bigint;
  readonly pending: bigint;
}

// How many times an address has claimed a milestone from a game's rewards contract, as the chain's indexed state says. It is
// how the platform tells that a claim it watched confirm has also been indexed (state `complete`, never earlier); it
// reads only what the platform itself performs a claim for.
export interface RewardsReader {
  claimed(
    contract: ContractRef,
    holder: Address,
    milestoneId: string,
  ): Promise<number>;
  // The picture and facts the chain serves for one collectible, or null when no such collectible exists. The caller checks the
  // issuer against the games it lists.
  preview(item: ContractRef): Promise<CollectiblePreview | null>;
}

export interface ChainPorts {
  readonly addressCodec: AddressCodec;
  readonly broadcaster: Broadcaster;
  readonly contracts: ContractGateway;
  readonly observer: ChainObserver;
  readonly reader: ChainReader;
  readonly rewards: RewardsReader;
  readonly builder: TransactionBuilder;
}
