import type { ChainPorts } from "@ador/chain/ports";
import type {
  ChainFamilyId,
  ChainRef,
  ContractRef,
  FundingPolicy,
  TrackedState,
  TransactionSummary,
  UnsignedTransaction,
} from "@ador/shared/chain";

import type { ContractStore, Recording } from "@ador/database/game-contracts";

// What staff do through this package. On a game that has a contract: define a milestone, pause or resume claims. Before it has one:
// publish a template (once for every game) and create the game's contract from it.
export type AdminAction =
  | {
      readonly drawing?: string | undefined;
      readonly milestoneId: string;
      readonly operation: "define-milestone";
    }
  | { readonly operation: "set-claims-paused"; readonly paused: boolean }
  | {
      // The largest drawing the new contract will accept.
      readonly maxDrawingBytes: number;
      readonly operation: "deploy";
    }
  | {
      // Where on the chain staff publish the code, in the chain's notation.
      readonly address: string;
      readonly operation: "publish-template";
      readonly templateId: string;
      readonly templateVersion: string;
    };

// A template by id and version.
export interface TemplateRef {
  readonly id: string;
  readonly version: string;
}

// What the platform has decided about its rewards chain: the chain, the templates it may publish, which of them a game and its
// collectibles are made from, and the most a game's contract may be created to accept.
export interface RewardsPlan {
  readonly chain: ChainRef;
  // The family of the chain, which a contract on it is named with.
  readonly family: ChainFamilyId;
  readonly collectibleTemplate: TemplateRef;
  readonly gameTemplate: TemplateRef;
  readonly maxDrawingBytes: bigint;
  readonly publishable: readonly TemplateRef[];
}

export interface StoredStep {
  readonly chain: ChainRef;
  // The contract the step acts on; none for publishing a template or creating a game's contract.
  readonly contract: ContractRef | null;
  readonly createdAt: Date;
  readonly createdBy: string | null;
  // What the chain reported the step created, once it ran.
  readonly createdContracts: readonly string[] | null;
  readonly expiresAt: Date;
  readonly failureReason: string | null;
  // The game the step is about; none for publishing a template.
  readonly gameId: string | null;
  readonly id: string;
  readonly milestoneId: string | null;
  readonly operation: AdminAction["operation"];
  readonly signedPayload: string | null;
  readonly state: TrackedState;
  readonly submittedBy: string | null;
  // `id@version`, for publishing a template.
  readonly templateRef: string | null;
  readonly transactionId: string | null;
  // What staff were shown and asked to sign.
  readonly unsigned: UnsignedTransaction;
  readonly updatedAt: Date;
}

export type NewStep = Pick<
  StoredStep,
  | "chain"
  | "contract"
  | "createdAt"
  | "expiresAt"
  | "gameId"
  | "id"
  | "milestoneId"
  | "operation"
  | "templateRef"
  | "unsigned"
> & { readonly createdBy: string };

export interface StepChange {
  // The contracts the chain reported the step created, kept with the step when it is confirmed.
  readonly createdContracts?: readonly string[];
  readonly failureReason?: string;
  // What completing the step adds to the record of the chain; written in the same moment.
  readonly record?: Recording;
  readonly signedPayload?: string;
  readonly state: TrackedState;
  readonly submittedBy?: string;
  readonly transactionId?: string;
}

export type CreateStepResult =
  | { readonly kind: "already-defined" }
  | { readonly kind: "created"; readonly step: StoredStep }
  | { readonly kind: "in-progress"; readonly step: StoredStep };

// Where steps live. `create` does what must not be done in two steps: it lets an unsigned step that has run out of time expire,
// hands back the step already in progress, refuses to define a milestone that is already defined on chain, and otherwise adds the
// step, all while no other start for the same game, operation and milestone can interleave. `update` holds the step's row while
// `decide` runs, so two steps on one transaction never overwrite each other.
export interface GameAdminRepository {
  create(step: NewStep): Promise<CreateStepResult>;
  get(stepId: string): Promise<StoredStep | null>;
  // A game's steps, or (with null) the steps that publish templates, oldest first.
  list(gameId: string | null): Promise<readonly StoredStep[]>;
  update(
    stepId: string,
    decide: (step: StoredStep) => StepChange | null,
  ): Promise<StoredStep | null>;
}

// What the service knows of a game: the chain it is on, the rewards contract deployed for it (none until one is), the claim limit
// of each milestone the manifest declares, and the largest drawing the contract accepts.
export interface AdministeredGame {
  readonly chain: ChainRef;
  // Learned from the chain when the step that created it completed.
  readonly contract: ContractRef | null;
  readonly maxDrawingBytes: bigint;
  readonly milestones: ReadonlyMap<string, { readonly claimLimit: number }>;
}

// Where a game stands before any step is taken on it.
export interface GameStatus {
  readonly contract: {
    readonly address: string;
    readonly maxDrawingBytes: number;
  } | null;
  // The most a new contract may be created to accept.
  readonly drawingCeiling: number;
  readonly templatesReady: boolean;
}

export type AdminChainPorts = Pick<
  ChainPorts,
  "addressCodec" | "broadcaster" | "builder" | "observer"
>;

export type DrawingCheck =
  | { readonly ok: true; readonly svg: string }
  | { readonly detail: string; readonly ok: false };

export interface GameAdminDependencies {
  readonly clock: () => Date;
  funding(chain: ChainRef): FundingPolicy;
  game(gameId: string): Promise<AdministeredGame | null>;
  newId(): string;
  ports(chain: ChainRef): AdminChainPorts | null;
  readonly repository: GameAdminRepository;
  readonly contracts: ContractStore;
  readonly rewards: RewardsPlan;
  // Cleans a drawing before it goes on chain; the byte limit is the game's contract's.
  sanitise(drawing: string, maxBytes: bigint): DrawingCheck;
}

// A step as staff or a page are told of it. The transaction to sign is given only while the wallet is still to be asked.
export interface StepView {
  readonly createdAt: string;
  readonly createdBy: string | null;
  readonly expiresAt: string;
  readonly failureReason: string | null;
  readonly createdContracts: readonly string[];
  readonly gameId: string | null;
  readonly id: string;
  readonly milestoneId: string | null;
  readonly operation: AdminAction["operation"];
  readonly state: StoredStep["state"];
  readonly submittedBy: string | null;
  readonly summary: TransactionSummary;
  readonly templateRef: string | null;
  readonly toSign: UnsignedTransaction | null;
  readonly transactionId: string | null;
}

export interface StartStepInput {
  readonly action: AdminAction;
  // The output that holds the game's auth token ("txid:vout"), for the chains whose steps must present it.
  readonly authTokenOutput?: string | undefined;
  // The game the step is for; null when publishing a template.
  readonly gameId: string | null;
  readonly staffId: string;
  // The address of the wallet staff will sign with, as the page gives it: parsed for the game's chain here.
  readonly wallet: string;
}

export type StartStepResult =
  | { readonly ok: true; readonly resumed: boolean; readonly step: StepView }
  | {
      readonly code:
        | "already-created"
        | "already-defined"
        | "already-published"
        | "address-taken"
        | "chain-unavailable"
        | "not-administered"
        | "template-not-published"
        | "unavailable"
        | "unknown-template"
        | "wrong-chain";
      readonly ok: false;
    }
  | {
      readonly code: "bad-drawing" | "could-not-build";
      readonly ok: false;
      readonly reason: string;
    };

export type SubmitStepResult =
  | { readonly ok: true; readonly step: StepView }
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

export type RefreshStepResult =
  | { readonly ok: true; readonly step: StepView }
  | { readonly code: "chain-unavailable" | "not-found"; readonly ok: false };
