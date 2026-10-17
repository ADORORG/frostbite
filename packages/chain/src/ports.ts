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
  inspect(ref: ContractRef): Promise<ContractInspection>;
  simulate(intent: TransactionIntent): Promise<SimulationResult>;
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
