import type {
  CreatorAdmissionAction,
  CreatorApplicationDraft,
  CreatorApplicationState,
  CreatorReviewPosition,
  CreatorReviewSort,
} from "@frostbite/shared/creator-admission";
import type { PlatformRole } from "@frostbite/shared/accounts";
import type { UuidV7 } from "@frostbite/shared/identifiers";
import type { CorrelationId, IdempotencyKey } from "@frostbite/shared/http";

export interface CreatorApplicationFeedback {
  readonly createdAt: Date;
  readonly text: string;
}

export interface CreatorApplicationView {
  readonly applicantUserId: UuidV7;
  readonly draft: CreatorApplicationDraft;
  // The latest message a reviewer wrote for the applicant; null until there is one.
  readonly feedback: CreatorApplicationFeedback | null;
  readonly id: UuidV7;
  readonly revision: number;
  readonly state: CreatorApplicationState;
}

// One application in the review queue: the version last sent, and when. `sortKey` is the value the list was
// ordered by (a time, or a lower-cased name), which is what a next page continues from.
export interface CreatorReviewQueueRow {
  readonly applicationId: UuidV7;
  readonly displayName: string;
  readonly sortKey: string;
  readonly state: CreatorApplicationState;
  readonly submissionNumber: number;
  readonly submittedAt: Date;
  readonly updatedAt: Date;
}

export interface CreatorReviewEventRecord {
  readonly action: CreatorAdmissionAction;
  readonly actorName: string;
  readonly createdAt: Date;
  readonly creatorFeedback: string;
  readonly nextState: CreatorApplicationState;
  readonly previousState: CreatorApplicationState;
  readonly privateNotes: string;
  readonly reasonCode: string;
}

// An application as staff read it: the frozen version a decision is about, and everything that happened.
export interface CreatorReviewDetailRecord {
  readonly applicationId: UuidV7;
  readonly events: readonly CreatorReviewEventRecord[];
  readonly snapshot: CreatorApplicationDraft;
  readonly state: CreatorApplicationState;
  readonly submissionNumber: number;
  readonly submittedAt: Date;
}

export type CreatorMutationResult =
  | { readonly application: CreatorApplicationView; readonly kind: "changed" }
  | { readonly application: CreatorApplicationView; readonly kind: "replayed" }
  | { readonly kind: "conflict" }
  | { readonly kind: "contact-unverified" }
  | { readonly kind: "forbidden" }
  | { readonly kind: "not-found" };

export interface MutationContext {
  readonly actorUserId: UuidV7;
  readonly changedAt: Date;
  readonly correlationId: CorrelationId;
  readonly idempotencyKey: IdempotencyKey;
  readonly policyVersion: string;
  readonly requestFingerprint: string;
}

export interface CreatorAdmissionRepository {
  findForApplicant(
    applicantUserId: UuidV7,
  ): Promise<CreatorApplicationView | null>;
  // How many submitted applications are in each state (a draft that was never sent is not counted).
  countsForReview(): Promise<ReadonlyMap<CreatorApplicationState, number>>;
  // Submitted applications in the given states, in the given order, after `position` when there is one.
  listForReview(input: {
    readonly limit: number;
    readonly position: CreatorReviewPosition | null;
    readonly sort: CreatorReviewSort;
    readonly states: readonly CreatorApplicationState[];
  }): Promise<readonly CreatorReviewQueueRow[]>;
  // Null for an application that does not exist or was never sent: a draft is private to its applicant.
  readForReview(
    applicationId: UuidV7,
  ): Promise<CreatorReviewDetailRecord | null>;
  review(
    input: MutationContext & {
      readonly action: CreatorAdmissionAction;
      readonly allowedReviewerRoles: readonly PlatformRole[];
      readonly applicationId: UuidV7;
      readonly creatorFeedback: string;
      readonly evidenceReferences: readonly string[];
      readonly privateNotes: string;
      readonly reasonCode: string;
    },
  ): Promise<CreatorMutationResult>;
  saveDraft(
    input: MutationContext & {
      readonly applicationId: UuidV7;
      readonly draft: CreatorApplicationDraft;
    },
  ): Promise<CreatorMutationResult>;
  submit(
    input: MutationContext & {
      readonly schemaVersion: number;
    },
  ): Promise<CreatorMutationResult>;
}
