import type { GameClaimsService } from "@ador/game-claims";
import type { HttpOperation } from "@ador/http";
import { unauthenticated } from "@ador/http/outcome";
import {
  listMintedMilestonesInputSchema,
  listMintedMilestonesResponseSchema,
  listMintedMilestonesRoute,
  type ListMintedMilestonesInput,
  type ListMintedMilestonesResponse,
} from "@ador/shared/games";

// What the signed-in player has minted across games, newest first. The owner is the session, never a field of the request.
export function createListMintedMilestonesOperation(
  getService: () => Promise<Pick<GameClaimsService, "minted">>,
) {
  return {
    access: { kind: "authenticated" },
    applicationErrors: ["unauthorized"],
    execute: async (_input, context) => {
      if (context.actorUserId === null) return unauthenticated;
      const minted = await (await getService()).minted(context.actorUserId);
      return { ok: true, value: { minted: [...minted] } } as const;
    },
    idempotency: "none",
    input: "json",
    inputSchema: listMintedMilestonesInputSchema,
    outputSchema: listMintedMilestonesResponseSchema,
    ...listMintedMilestonesRoute,
  } satisfies HttpOperation<
    ListMintedMilestonesInput,
    ListMintedMilestonesResponse
  >;
}
