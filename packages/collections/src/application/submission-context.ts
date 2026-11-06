import { collectionReviewPolicyVersion } from "@frostbite/shared/collections";
import type { JsonValue } from "@frostbite/shared/chain";
import {
  correlationIdSchema,
  idempotencyKeySchema,
  requestFingerprint,
} from "@frostbite/shared/http";
import type { UuidV7 } from "@frostbite/shared/identifiers";

import type { SubmissionMutation } from "./submission-repository.ts";

export interface RequestContext {
  readonly actorUserId: UuidV7;
  readonly correlationId: string;
  readonly idempotencyKey: string;
}

export interface ContextDependencies {
  readonly clock: () => Date;
  readonly createId: () => UuidV7;
}

// Validates the request's identifiers and derives the idempotency fingerprint. The actor is part of
// the fingerprint, so a key replayed by someone else is a conflict, never someone's recorded result.
export function mutationContext(
  dependencies: ContextDependencies,
  request: RequestContext,
  operation: string,
  content: JsonValue,
): SubmissionMutation {
  return {
    actorUserId: request.actorUserId,
    changedAt: dependencies.clock(),
    correlationId: correlationIdSchema.parse(request.correlationId),
    eventId: dependencies.createId(),
    idempotencyKey: idempotencyKeySchema.parse(request.idempotencyKey),
    policyVersion: collectionReviewPolicyVersion,
    requestFingerprint: requestFingerprint({
      actorUserId: request.actorUserId,
      content,
      operation,
    }),
  };
}
