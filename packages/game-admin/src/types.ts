import type { ChainPorts } from "@ador/chain/ports";
import type {
  ChainRef,
  ContractRef,
  FundingPolicy,
  TrackedState,
  TransactionSummary,
  UnsignedTransaction,
} from "@ador/shared/chain";

// What staff do to a game's rewards contract through this package. Publishing a template and creating a game are not here: they
// happen once, before a game has a contract to administer.
export type AdminAction =
  | {
      readonly drawing?: string | undefined;
      readonly milestoneId: string;
      readonly operation: "define-milestone";
    }
  | { readonly operation: "set-claims-paused"; readonly paused: boolean };

export interface StoredStep {
  readonly chain: ChainRef;
  readonly contract: ContractRef;
  readonly createdAt: Date;
  readonly createdBy: string | null;
  readonly expiresAt: Date;
  readonly failureReason: string | null;
  readonly gameId: string;
  readonly id: string;
  readonly milestoneId: string | null;
  readonly operation: AdminAction["operation"];
  readonly signedPayload: string | null;
  readonly state: TrackedState;
  readonly submittedBy: string | null;
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
  | "unsigned"
> & { readonly createdBy: string };

export interface StepChange {
  readonly failureReason?: string;
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
  list(gameId: string): Promise<readonly StoredStep[]>;
  update(
    stepId: string,
    decide: (step: StoredStep) => StepChange | null,
  ): Promise<StoredStep | null>;
}

// What the service knows of a game: the chain it is on, the rewards contract deployed for it (none until one is), the claim limit
// of each milestone the manifest declares, and the largest drawing the contract accepts.
export interface AdministeredGame {
  readonly chain: ChainRef;
  readonly contract: ContractRef | null;
  readonly maxDrawingBytes: bigint;
  readonly milestones: ReadonlyMap<string, { readonly claimLimit: number }>;
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
  game(gameId: string): AdministeredGame | null;
  newId(): string;
  ports(chain: ChainRef): AdminChainPorts | null;
  readonly repository: GameAdminRepository;
  // Cleans a drawing before it goes on chain; the byte limit is the game's contract's.
  sanitise(drawing: string, maxBytes: bigint): DrawingCheck;
}

// A step as staff or a page are told of it. The transaction to sign is given only while the wallet is still to be asked.
export interface StepView {
  readonly createdAt: string;
  readonly createdBy: string | null;
  readonly expiresAt: string;
  readonly failureReason: string | null;
  readonly gameId: string;
  readonly id: string;
  readonly milestoneId: string | null;
  readonly operation: AdminAction["operation"];
  readonly state: StoredStep["state"];
  readonly submittedBy: string | null;
  readonly summary: TransactionSummary;
  readonly toSign: UnsignedTransaction | null;
  readonly transactionId: string | null;
}

export interface StartStepInput {
  readonly action: AdminAction;
  // The output that holds the game's auth token ("txid:vout"), for the chains whose steps must present it.
  readonly authTokenOutput?: string | undefined;
  readonly gameId: string;
  readonly staffId: string;
  // The address of the wallet staff will sign with, as the page gives it: parsed for the game's chain here.
  readonly wallet: string;
}

export type StartStepResult =
  | { readonly ok: true; readonly resumed: boolean; readonly step: StepView }
  | {
      readonly code:
        | "already-defined"
        | "chain-unavailable"
        | "not-administered"
        | "unavailable"
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
