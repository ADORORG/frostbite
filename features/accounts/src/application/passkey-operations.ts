import {
  passkeyBeginResponseSchema,
  passkeyEmptyInputSchema,
  passkeyFinishInputSchema,
  passkeyListResponseSchema,
  passkeyMutationResponseSchema,
  passkeyRoutes,
  passkeyUnlinkInputSchema,
  type createPasskeyLinkingService,
} from "@frostbite/auth";
import type { HttpOperation, HttpOperationResult } from "@frostbite/http";
import { unauthenticated } from "@frostbite/http/outcome";
import { uuidV7Schema } from "@frostbite/shared/identifiers";

import { outcomeFailure } from "./outcomes.ts";

type Service = ReturnType<typeof createPasskeyLinkingService>;
type MutationResult = HttpOperationResult<{ readonly changed: true }>;
type FailureResult = Extract<MutationResult, { readonly ok: false }>;

const errors = ["conflict", "forbidden", "unauthorized"] as const;

function sessionOrFailure(
  session: Parameters<Service["begin"]>[0]["session"] | null,
) {
  return session ?? unauthenticated;
}

function mutationFailure(code: string): FailureResult {
  return outcomeFailure(
    code === "recent-authentication-required"
      ? "recent-authentication-required"
      : "passkey-change-failed",
  );
}

export function createPasskeyOperations(getService: () => Service) {
  const list: HttpOperation<
    Record<string, never>,
    { readonly credentialIds: string[] }
  > = {
    access: { kind: "authenticated" },
    applicationErrors: errors,
    execute: async (_input, context) => {
      const session = sessionOrFailure(context.actorSession);
      return "sessionId" in session
        ? {
            ok: true,
            value: {
              credentialIds: [...(await getService().list(session.userId))],
            },
          }
        : session;
    },
    idempotency: "none",
    input: "none",
    inputSchema: passkeyEmptyInputSchema,
    outputSchema: passkeyListResponseSchema,
    ...passkeyRoutes.list,
    cache: { kind: "revalidate" },
  };
  const begin: HttpOperation<
    Record<string, never>,
    ReturnType<typeof passkeyBeginResponseSchema.parse>
  > = {
    access: { kind: "authenticated" },
    applicationErrors: errors,
    execute: async (_input, context) => {
      const session = sessionOrFailure(context.actorSession);
      if (!("sessionId" in session)) return session;
      const result = await getService().begin({
        session,
        userName: session.userId,
      });
      return result === null
        ? mutationFailure("recent-authentication-required")
        : {
            ok: true,
            value: {
              challengeId: result.challengeId,
              expiresAt: result.expiresAt.toISOString(),
              options: result.options,
            },
          };
    },
    idempotency: "none",
    input: "json",
    inputSchema: passkeyEmptyInputSchema,
    outputSchema: passkeyBeginResponseSchema,
    ...passkeyRoutes.beginRegistration,
  };
  const finish: HttpOperation<
    ReturnType<typeof passkeyFinishInputSchema.parse>,
    { readonly changed: true }
  > = {
    access: { kind: "authenticated" },
    applicationErrors: errors,
    execute: async (input, context) => {
      const session = sessionOrFailure(context.actorSession);
      if (!("sessionId" in session)) return session;
      const result = await getService().finish({
        challengeId: uuidV7Schema.parse(input.challengeId),
        correlationId: context.correlationId,
        payload: input.credential,
        session,
      });
      return result.ok
        ? {
            effects: [
              { kind: "replace-platform-session", token: result.sessionToken },
            ],
            ok: true,
            value: { changed: true },
          }
        : mutationFailure(result.code);
    },
    idempotency: "none",
    input: "json",
    inputSchema: passkeyFinishInputSchema,
    outputSchema: passkeyMutationResponseSchema,
    ...passkeyRoutes.finishRegistration,
  };
  const unlink: HttpOperation<
    ReturnType<typeof passkeyUnlinkInputSchema.parse>,
    { readonly changed: true }
  > = {
    access: { kind: "authenticated" },
    applicationErrors: errors,
    execute: async (input, context) => {
      const session = sessionOrFailure(context.actorSession);
      if (!("sessionId" in session)) return session;
      const result = await getService().unlink({
        ...input,
        correlationId: context.correlationId,
        session,
      });
      return result.ok
        ? {
            effects: [
              { kind: "replace-platform-session", token: result.sessionToken },
            ],
            ok: true,
            value: { changed: true },
          }
        : mutationFailure(result.code);
    },
    idempotency: "none",
    input: "json",
    inputSchema: passkeyUnlinkInputSchema,
    outputSchema: passkeyMutationResponseSchema,
    ...passkeyRoutes.unlink,
  };
  return [list, begin, finish, unlink] as const;
}
