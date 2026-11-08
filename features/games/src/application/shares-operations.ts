import type { GameSharesService } from "@frostbite/game-shares";
import type { HttpOperation } from "@frostbite/http";
import { unauthenticated } from "@frostbite/http/outcome";
import {
  createShareInputSchema,
  createShareResponseSchema,
  createShareRoute,
  revokeShareInputSchema,
  revokeShareResponseSchema,
  revokeShareRoute,
  sharePath,
  type CreateShareInput,
  type CreateShareResponse,
  type RevokeShareInput,
  type RevokeShareResponse,
} from "@frostbite/shared/games";

type Service = () => Promise<GameSharesService>;

// Makes a link for something the signed-in player earned. The owner is the session, never a field of the request; asking again for
// the same thing gives the same link.
export function createCreateShareOperation(getService: Service) {
  return {
    access: { kind: "authenticated" },
    applicationErrors: ["unauthorized"],
    execute: async (input, context) => {
      if (context.actorUserId === null) return unauthenticated;
      const outcome = await (
        await getService()
      ).create(context.actorUserId, input);
      return {
        ok: true,
        value:
          outcome.kind === "shared"
            ? {
                id: outcome.share.id,
                path: sharePath(outcome.share.id),
                status: "shared",
              }
            : { reason: outcome.kind, status: "unavailable" },
      } as const;
    },
    idempotency: "none",
    input: "json",
    inputSchema: createShareInputSchema,
    outputSchema: createShareResponseSchema,
    ...createShareRoute,
  } satisfies HttpOperation<CreateShareInput, CreateShareResponse>;
}

// Ends one of the player's own links. A link that is not theirs and one that does not exist answer alike.
export function createRevokeShareOperation(getService: Service) {
  return {
    access: { kind: "authenticated" },
    applicationErrors: ["unauthorized"],
    execute: async (input, context) => {
      if (context.actorUserId === null) return unauthenticated;
      return {
        ok: true,
        value: {
          revoked: await (
            await getService()
          ).revoke(context.actorUserId, input.id),
        },
      } as const;
    },
    idempotency: "none",
    input: "json",
    inputSchema: revokeShareInputSchema,
    outputSchema: revokeShareResponseSchema,
    ...revokeShareRoute,
  } satisfies HttpOperation<RevokeShareInput, RevokeShareResponse>;
}
