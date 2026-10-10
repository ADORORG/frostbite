import type {
  ReviewAction,
  SubmissionAction,
  SubmissionRequirement,
  SubmissionSnapshot,
  SubmissionState,
} from "@ador/shared/collections";
import type { PlatformRole } from "@ador/shared/accounts";
import type { CorrelationId, IdempotencyKey } from "@ador/shared/http";
import type { UuidV7 } from "@ador/shared/identifiers";

export interface SubmissionDecisionRecord {
  readonly action: SubmissionAction;
  readonly createdAt: Date;
  readonly creatorFeedback: string;
  readonly nextState: SubmissionState;
}

export interface SubmissionRecord {
  readonly collectionId: UuidV7;
  readonly collectionRevision: number;
  readonly createdAt: Date;
  // What the creator may see: decisions and the feedback written for them, never private notes.
  readonly decisions: readonly SubmissionDecisionRecord[];
  readonly id: UuidV7;
  readonly ownerUserId: UuidV7;
  readonly payloadHash: string;
  readonly sequence: number;
  readonly state: SubmissionState;
  readonly updatedAt: Date;
}

export interface ReviewEventRecord extends SubmissionDecisionRecord {
  readonly actorUserId: UuidV7;
  readonly previousState: SubmissionState | null;
  readonly privateNotes: string;
  readonly reasonCode: string;
}

export interface ReviewSubmissionRecord extends SubmissionRecord {
  readonly events: readonly ReviewEventRecord[];
  readonly snapshot: SubmissionSnapshot;
}

export interface ReviewQueueRecord {
  readonly collectionId: UuidV7;
  readonly collectionName: string;
  readonly createdAt: Date;
  readonly id: UuidV7;
  readonly sequence: number;
  readonly state: SubmissionState;
  readonly updatedAt: Date;
}

// Retryable operations carry an idempotency key and a fingerprint of their meaningful content (which
// includes the actor, so a key cannot be replayed by someone else).
export interface SubmissionMutation {
  readonly actorUserId: UuidV7;
  readonly changedAt: Date;
  readonly correlationId: CorrelationId;
  readonly eventId: UuidV7;
  readonly idempotencyKey: IdempotencyKey;
  readonly policyVersion: string;
  readonly requestFingerprint: string;
}

// Every outcome a mutation can report without throwing. `not-found` also covers another creator's
// collection and an unknown submission, so existence is not disclosed.
export type SubmitResult =
  | { readonly kind: "conflict" }
  | { readonly kind: "invalid-asset"; readonly assetId: string }
  | { readonly kind: "invalid-chain" }
  | { readonly kind: "not-eligible" }
  | { readonly kind: "not-found" }
  | {
      readonly kind: "not-ready";
      readonly missing: readonly SubmissionRequirement[];
    }
  | {
      readonly kind: "not-submittable";
      readonly reason: "closed" | "in-review";
    }
  | { readonly currentRevision: number; readonly kind: "revision-conflict" }
  | { readonly kind: "replayed"; readonly submission: SubmissionRecord }
  | { readonly kind: "submitted"; readonly submission: SubmissionRecord };

export type DecideResult =
  | { readonly kind: "conflict" }
  | { readonly kind: "forbidden" }
  | { readonly kind: "invalid-transition"; readonly state: SubmissionState }
  | { readonly kind: "not-found" }
  | { readonly kind: "owner-not-eligible" }
  | { readonly kind: "decided"; readonly submission: ReviewSubmissionRecord }
  | { readonly kind: "replayed"; readonly submission: ReviewSubmissionRecord };

// What a creator does with their own collection: freeze it for review and follow the outcome.
export interface SubmissionAuthoring {
  // The submissions of the caller's own collection, newest first. Another creator's is empty.
  listForOwner(input: {
    readonly collectionId: UuidV7;
    readonly ownerUserId: UuidV7;
  }): Promise<readonly SubmissionRecord[]>;
  submit(
    input: SubmissionMutation & {
      // Chains a collection may currently target; one that no longer is cannot be submitted.
      readonly allowedChains: readonly string[];
      readonly collectionId: UuidV7;
      readonly expectedRevision: number;
      readonly submissionId: UuidV7;
    },
  ): Promise<SubmitResult>;
}

// What staff do with submissions: find them, read them in full, and decide.
export interface ReviewRepository {
  decide(
    input: SubmissionMutation & {
      readonly action: ReviewAction;
      readonly allowedReviewerRoles: readonly PlatformRole[];
      readonly creatorFeedback: string;
      readonly privateNotes: string;
      readonly reasonCode: string;
      readonly submissionId: UuidV7;
    },
  ): Promise<DecideResult>;
  queue(input: {
    readonly limit: number;
    readonly states: readonly SubmissionState[];
  }): Promise<readonly ReviewQueueRecord[]>;
  readForReview(submissionId: UuidV7): Promise<ReviewSubmissionRecord | null>;
}

export type SubmissionRepository = SubmissionAuthoring & ReviewRepository;
