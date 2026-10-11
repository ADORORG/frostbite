import type {
  CreatorAdmissionAction,
  CreatorApplicationDraft,
  CreatorApplicationState,
} from "@ador/shared/creator-admission";
import type { PlatformRole } from "@ador/shared/accounts";
import type { UuidV7 } from "@ador/shared/identifiers";
import type { CorrelationId, IdempotencyKey } from "@ador/shared/http";

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
