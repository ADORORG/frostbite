import {
  platformRoles,
  type AuthorizationPolicy,
  type PlatformRole,
} from "@ador/shared/accounts";
import {
  collectionReviewCapability,
  reviewDecisionSchema,
  type ReviewDecision,
  type SubmissionState,
} from "@ador/shared/collections";
import { uuidV7Schema, type UuidV7 } from "@ador/shared/identifiers";

import { mutationContext, type RequestContext } from "./submission-context.ts";
import type {
  DecideResult,
  ReviewQueueRecord,
  ReviewRepository,
  ReviewSubmissionRecord,
} from "./submission-repository.ts";

export interface ReviewServiceDependencies {
  readonly authorizationPolicy: AuthorizationPolicy;
  readonly clock: () => Date;
  readonly createId: () => UuidV7;
  readonly queueLimit: number;
  readonly repository: ReviewRepository;
}

function reviewerRoles(policy: AuthorizationPolicy): readonly PlatformRole[] {
  return platformRoles.filter((role) =>
    policy.platform[role].includes(collectionReviewCapability),
  );
}

// Staff deciding on submissions. Which roles may decide comes from the authorization policy; the
// repository checks the role is still active, that the reviewer is not the creator, and that the
// transition is legal, all inside the transaction that records the decision.
export function createReviewService(dependencies: ReviewServiceDependencies) {
  const allowedReviewerRoles = reviewerRoles(dependencies.authorizationPolicy);
  return {
    decide(
      decisionInput: ReviewDecision,
      request: RequestContext,
    ): Promise<DecideResult> {
      const decision = reviewDecisionSchema.parse(decisionInput);
      return dependencies.repository.decide({
        ...mutationContext(dependencies, request, "decide", decision),
        ...decision,
        allowedReviewerRoles,
        submissionId: uuidV7Schema.parse(decision.submissionId),
      });
    },

    queue(
      states: readonly SubmissionState[],
    ): Promise<readonly ReviewQueueRecord[]> {
      return dependencies.repository.queue({
        limit: dependencies.queueLimit,
        states,
      });
    },

    readForReview(
      submissionId: UuidV7,
    ): Promise<ReviewSubmissionRecord | null> {
      return dependencies.repository.readForReview(submissionId);
    },
  };
}
