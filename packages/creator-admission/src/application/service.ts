import {
  platformRoles,
  type AuthorizationPolicy,
  type PlatformRole,
} from "@ador/shared/accounts";
import {
  creatorAdmissionPolicyVersion,
  creatorApplicationDraftSchema,
  creatorApplicationSchemaVersion,
  creatorApplicationSubmissionSchema,
  creatorReviewDecisionSchema,
  statesInGroup,
  type CreatorApplicationDraft,
  type CreatorReviewDecision,
  type CreatorReviewGroup,
  type CreatorReviewPosition,
  type CreatorReviewSort,
} from "@ador/shared/creator-admission";
import { createHash } from "node:crypto";

import { correlationIdSchema, idempotencyKeySchema } from "@ador/shared/http";
import type { UuidV7 } from "@ador/shared/identifiers";

import type {
  CreatorAdmissionRepository,
  MutationContext,
} from "./repository.ts";

export interface CreatorAdmissionDependencies {
  readonly authorizationPolicy: AuthorizationPolicy;
  readonly clock: () => Date;
  readonly createId: () => UuidV7;
  // How many applications one page of the review queue holds.
  readonly queuePageSize: number;
  readonly repository: CreatorAdmissionRepository;
}

export interface CreatorMutationRequestContext {
  readonly actorUserId: UuidV7;
  readonly correlationId: string;
  readonly idempotencyKey: string;
}

function context(
  input: CreatorMutationRequestContext,
  dependencies: CreatorAdmissionDependencies,
  fingerprintSource: object,
): MutationContext {
  return {
    actorUserId: input.actorUserId,
    changedAt: dependencies.clock(),
    correlationId: correlationIdSchema.parse(input.correlationId),
    idempotencyKey: idempotencyKeySchema.parse(input.idempotencyKey),
    policyVersion: creatorAdmissionPolicyVersion,
    requestFingerprint: createHash("sha256")
      .update(JSON.stringify(fingerprintSource))
      .digest("hex"),
  };
}

function reviewerRoles(policy: AuthorizationPolicy): readonly PlatformRole[] {
  return platformRoles.filter((role) =>
    policy.platform[role].includes("creator:review"),
  );
}

export function createCreatorAdmissionService(
  dependencies: CreatorAdmissionDependencies,
) {
  const allowedReviewerRoles = reviewerRoles(dependencies.authorizationPolicy);
  return {
    findMine(actorUserId: UuidV7) {
      return dependencies.repository.findForApplicant(actorUserId);
    },

    saveDraft(
      draftInput: CreatorApplicationDraft,
      request: CreatorMutationRequestContext,
    ) {
      const draft = creatorApplicationDraftSchema.parse(draftInput);
      return dependencies.repository.saveDraft({
        ...context(request, dependencies, { draft, operation: "save-draft" }),
        applicationId: dependencies.createId(),
        draft,
      });
    },

    async submit(request: CreatorMutationRequestContext) {
      const application = await dependencies.repository.findForApplicant(
        request.actorUserId,
      );
      if (application === null) return { kind: "not-found" } as const;
      creatorApplicationSubmissionSchema.parse(application.draft);
      return dependencies.repository.submit({
        ...context(request, dependencies, { operation: "submit" }),
        schemaVersion: creatorApplicationSchemaVersion,
      });
    },

    // One page of the review queue, with every group's size. `position` continues after the last row of the
    // previous page; the answer's `nextPosition` is null on the last page.
    async reviewQueue(input: {
      readonly group: CreatorReviewGroup;
      readonly position: CreatorReviewPosition | null;
      readonly sort: CreatorReviewSort;
    }) {
      const limit = dependencies.queuePageSize;
      const [rows, byState] = await Promise.all([
        dependencies.repository.listForReview({
          limit: limit + 1,
          position: input.position,
          sort: input.sort,
          states: statesInGroup(input.group),
        }),
        dependencies.repository.countsForReview(),
      ]);
      const items = rows.slice(0, limit);
      const last = items.at(-1);
      const total = (group: CreatorReviewGroup) =>
        statesInGroup(group).reduce(
          (sum, state) => sum + (byState.get(state) ?? 0),
          0,
        );
      return {
        counts: {
          active: total("active"),
          all: total("all"),
          finished: total("finished"),
          "needs-review": total("needs-review"),
        },
        items,
        nextPosition:
          rows.length > limit && last !== undefined
            ? { id: last.applicationId, key: last.sortKey }
            : null,
      };
    },

    readForReview(applicationId: UuidV7) {
      return dependencies.repository.readForReview(applicationId);
    },

    review(
      decisionInput: CreatorReviewDecision,
      request: CreatorMutationRequestContext,
    ) {
      const decision = creatorReviewDecisionSchema.parse(decisionInput);
      return dependencies.repository.review({
        ...context(request, dependencies, { decision, operation: "review" }),
        ...decision,
        allowedReviewerRoles,
      });
    },
  };
}
