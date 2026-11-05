import {
  platformRoles,
  type AuthorizationPolicy,
  type PlatformRole,
} from "@frostbite/shared/accounts";
import {
  collectionReviewCapability,
  reviewDecisionSchema,
  type ReviewDecision,
  type SubmissionState,
} from "@frostbite/shared/collections";
import { uuidV7Schema, type UuidV7 } from "@frostbite/shared/identifiers";

import { mutationContext, type RequestContext } from "./submission-context.ts";
import type {
  ActivityCursor,
  ActivityPage,
  DecideResult,
  ReviewQueueRecord,
  ReviewRepository,
  ReviewSubmissionRecord,
} from "./submission-repository.ts";

export interface ReviewServiceDependencies {
  readonly authorizationPolicy: AuthorizationPolicy;
  readonly clock: () => Date;
  readonly createId: () => UuidV7;
  // Events per page of the activity log; an engineering bound, not a product quota.
  readonly activityLimit: number;
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

    activity(cursor: ActivityCursor | null): Promise<ActivityPage> {
      return dependencies.repository.activity({
        cursor,
        limit: dependencies.activityLimit,
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
