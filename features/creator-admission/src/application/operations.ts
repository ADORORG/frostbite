import type { createCreatorAdmissionService } from "@ador/creator-admission";
import type { HttpOperation, HttpOperationResult } from "@ador/http";
import {
  creatorApplicationDraftInputSchema,
  creatorApplicationEmptyInputSchema,
  creatorApplicationResponseSchema,
  creatorApplicationReviewInputSchema,
  creatorReviewDecisionSchema,
  creatorApplicationRoutes,
  type CreatorApplicationDraftInput,
  type CreatorApplicationEmptyInput,
  type CreatorApplicationResponse,
  type CreatorApplicationReviewInput,
} from "@ador/shared/creator-admission";

import { presentApplication } from "./present.ts";

type Service = ReturnType<typeof createCreatorAdmissionService>;
type Result = HttpOperationResult<CreatorApplicationResponse>;
function requireActor(actorUserId: Parameters<Service["findMine"]>[0] | null) {
  return actorUserId === null
    ? ({
        error: "unauthorized",
        message: "Authentication is required.",
        ok: false,
      } as const)
    : actorUserId;
}

function mutationResult(
  result: Awaited<ReturnType<Service["saveDraft"]>>,
): Result {
  if (result.kind === "changed" || result.kind === "replayed") {
    return {
      ok: true,
      value: { application: presentApplication(result.application) },
    };
  }
  const mapping = {
    conflict: ["conflict", "The application state conflicts with this action."],
    "contact-unverified": ["forbidden", "Verified contact is required."],
    forbidden: ["forbidden", "The action is not permitted."],
    "not-found": ["not_found", "Creator application not found."],
  } as const;
  const [error, message] = mapping[result.kind];
  return { error, message, ok: false };
}

const errors = ["conflict", "forbidden", "not_found", "unauthorized"] as const;

export function createCreatorApplicationOperations(getService: () => Service) {
  const mine: HttpOperation<
    CreatorApplicationEmptyInput,
    CreatorApplicationResponse
  > = {
    access: { kind: "authenticated" },
    applicationErrors: errors,
    execute: async (_input, context) => {
      const actor = requireActor(context.actorUserId);
      if (typeof actor !== "string") return actor;
      const application = await getService().findMine(actor);
      return application === null
        ? {
            error: "not_found",
            message: "Creator application not found.",
            ok: false,
          }
        : { ok: true, value: { application: presentApplication(application) } };
    },
    idempotency: "none",
    input: "none",
    inputSchema: creatorApplicationEmptyInputSchema,
    outputSchema: creatorApplicationResponseSchema,
    ...creatorApplicationRoutes.mine,
  };
  const saveDraft: HttpOperation<
    CreatorApplicationDraftInput,
    CreatorApplicationResponse
  > = {
    access: { kind: "authenticated" },
    applicationErrors: errors,
    execute: async ({ draft }, context) => {
      const actor = requireActor(context.actorUserId);
      if (typeof actor !== "string") return actor;
      if (context.idempotencyKey === undefined)
        throw new Error("Idempotency boundary missing");
      return mutationResult(
        await getService().saveDraft(draft, {
          actorUserId: actor,
          correlationId: context.correlationId,
          idempotencyKey: context.idempotencyKey,
        }),
      );
    },
    idempotency: "required",
    input: "json",
    inputSchema: creatorApplicationDraftInputSchema,
    outputSchema: creatorApplicationResponseSchema,
    ...creatorApplicationRoutes.saveDraft,
  };
  const submit: HttpOperation<
    CreatorApplicationEmptyInput,
    CreatorApplicationResponse
  > = {
    access: { kind: "authenticated" },
    applicationErrors: errors,
    execute: async (_input, context) => {
      const actor = requireActor(context.actorUserId);
      if (typeof actor !== "string") return actor;
      if (context.idempotencyKey === undefined)
        throw new Error("Idempotency boundary missing");
      return mutationResult(
        await getService().submit({
          actorUserId: actor,
          correlationId: context.correlationId,
          idempotencyKey: context.idempotencyKey,
        }),
      );
    },
    idempotency: "required",
    input: "json",
    inputSchema: creatorApplicationEmptyInputSchema,
    outputSchema: creatorApplicationResponseSchema,
    ...creatorApplicationRoutes.submit,
  };
  const review: HttpOperation<
    CreatorApplicationReviewInput,
    CreatorApplicationResponse
  > = {
    access: { capability: "creator:review", kind: "platform" },
    applicationErrors: errors,
    execute: async (decision, context) => {
      const actor = requireActor(context.actorUserId);
      if (typeof actor !== "string") return actor;
      if (context.idempotencyKey === undefined)
        throw new Error("Idempotency boundary missing");
      return mutationResult(
        await getService().review(creatorReviewDecisionSchema.parse(decision), {
          actorUserId: actor,
          correlationId: context.correlationId,
          idempotencyKey: context.idempotencyKey,
        }),
      );
    },
    idempotency: "required",
    input: "json",
    inputSchema: creatorApplicationReviewInputSchema,
    outputSchema: creatorApplicationResponseSchema,
    ...creatorApplicationRoutes.review,
  };
  return [mine, saveDraft, submit, review] as const;
}
