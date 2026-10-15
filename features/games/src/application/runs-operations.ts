import type { GameRunsService } from "@ador/game-runs";
import type { HttpOperation } from "@ador/http";
import { failure, unauthenticated } from "@ador/http/outcome";
import {
  startGameRunInputSchema,
  startGameRunResponseSchema,
  startGameRunRoute,
  submitGameRunInputSchema,
  submitGameRunResponseSchema,
  submitGameRunRoute,
  type StartGameRunInput,
  type StartGameRunResponse,
  type SubmitGameRunInput,
  type SubmitGameRunResponse,
} from "@ador/shared/games";

// Starts a run for the signed-in player. The owner is the session, never a field of the request. A game the platform has no
// verifier for answers not found: it cannot be replayed, so there is no run to give.
export function createStartGameRunOperation(
  getService: () => Promise<GameRunsService>,
) {
  return {
    access: { kind: "authenticated" },
    applicationErrors: ["conflict", "not_found", "unauthorized"],
    execute: async (input, context) => {
      if (context.actorUserId === null) return unauthenticated;
      const outcome = await (
        await getService()
      ).start(context.actorUserId, input.gameId);
      if (outcome.ok) return { ok: true, value: outcome.run } as const;
      return outcome.code === "unavailable"
        ? failure("not_found", "This game has no replay verification.")
        : failure(
            "conflict",
            "This player has too many unfinished runs of this game.",
          );
    },
    idempotency: "none",
    input: "json",
    inputSchema: startGameRunInputSchema,
    outputSchema: startGameRunResponseSchema,
    ...startGameRunRoute,
  } satisfies HttpOperation<StartGameRunInput, StartGameRunResponse>;
}

const refusals = {
  "already-submitted": "This run was already submitted.",
  expired: "This run has expired.",
  stale: "The game's rules changed since this run was started.",
} as const;

// Submits the record of a run the player was issued. A record the replay rejects is an answer, not an error: the run is
// spent either way (the seed is not reusable), and the response says which it was.
export function createSubmitGameRunOperation(
  getService: () => Promise<GameRunsService>,
) {
  return {
    access: { kind: "authenticated" },
    applicationErrors: ["conflict", "not_found", "unauthorized"],
    execute: async (input, context) => {
      if (context.actorUserId === null) return unauthenticated;
      const outcome = await (
        await getService()
      ).submit(context.actorUserId, input.gameId, input.runId, input.record);
      if (outcome.ok)
        return {
          ok: true,
          value: {
            earned: [...outcome.verdict.earned],
            reason: outcome.verdict.reason,
            status: outcome.verdict.status,
          },
        } as const;
      return outcome.code === "not-found"
        ? failure("not_found", "The run was not found.")
        : failure("conflict", refusals[outcome.code]);
    },
    idempotency: "none",
    input: "json",
    inputSchema: submitGameRunInputSchema,
    outputSchema: submitGameRunResponseSchema,
    ...submitGameRunRoute,
  } satisfies HttpOperation<SubmitGameRunInput, SubmitGameRunResponse>;
}
