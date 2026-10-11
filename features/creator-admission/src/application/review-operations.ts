import type { createCreatorAdmissionService } from "@ador/creator-admission";
import type { HttpOperation } from "@ador/http";
import { failure, unauthenticated } from "@ador/http/outcome";
import {
  creatorApplicationRoutes,
  creatorReviewQueueInputSchema,
  creatorReviewQueueResponseSchema,
  creatorReviewReadInputSchema,
  creatorReviewReadResponseSchema,
  decodeCreatorReviewCursor,
  encodeCreatorReviewCursor,
  type CreatorReviewQueueInput,
  type CreatorReviewQueueResponse,
  type CreatorReviewReadResponse,
} from "@ador/shared/creator-admission";
import { uuidV7Schema } from "@ador/shared/identifiers";

import { presentQueueItem, presentReviewDetail } from "./present.ts";

type Service = ReturnType<typeof createCreatorAdmissionService>;

// Reading applications for review is for reviewers only. The platform checks the capability before an
// operation runs; both operations are also refused without a signed-in actor.
const access = { capability: "creator:review", kind: "platform" } as const;

export function createCreatorReviewOperations(getService: () => Service) {
  const queue = {
    access,
    applicationErrors: ["forbidden", "invalid_request", "unauthorized"],
    execute: async (input, context) => {
      if (context.actorUserId === null) return unauthenticated;
      const position =
        input.cursor === null ? null : decodeCreatorReviewCursor(input.cursor);
      // A cursor this list did not produce is refused, not treated as the start of the list.
      if (input.cursor !== null && position === null)
        return failure("invalid_request", "The page cursor is not valid.");
      const page = await getService().reviewQueue({
        group: input.group,
        position,
        sort: input.sort,
      });
      return {
        ok: true,
        value: {
          counts: page.counts,
          items: page.items.map(presentQueueItem),
          nextCursor:
            page.nextPosition === null
              ? null
              : encodeCreatorReviewCursor(page.nextPosition),
        },
      } as const;
    },
    idempotency: "none",
    input: "json",
    inputSchema: creatorReviewQueueInputSchema,
    outputSchema: creatorReviewQueueResponseSchema,
    ...creatorApplicationRoutes.reviewQueue,
  } satisfies HttpOperation<
    CreatorReviewQueueInput,
    CreatorReviewQueueResponse
  >;
  const read = {
    access,
    applicationErrors: ["forbidden", "not_found", "unauthorized"],
    execute: async (input, context) => {
      if (context.actorUserId === null) return unauthenticated;
      const record = await getService().readForReview(
        uuidV7Schema.parse(input.applicationId),
      );
      return record === null
        ? failure("not_found", "The application was not found.")
        : ({
            ok: true,
            value: { application: presentReviewDetail(record) },
          } as const);
    },
    idempotency: "none",
    input: "json",
    inputSchema: creatorReviewReadInputSchema,
    outputSchema: creatorReviewReadResponseSchema,
    ...creatorApplicationRoutes.reviewRead,
  } satisfies HttpOperation<
    { readonly applicationId: string },
    CreatorReviewReadResponse
  >;
  return [queue, read] as const;
}
