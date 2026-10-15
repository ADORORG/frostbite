import type { GameRunsService } from "@ador/game-runs";
import type { HttpOperation } from "@ador/http";
import { unauthenticated } from "@ador/http/outcome";
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
// verifier for, or a player with too many open runs, is an answer ("unavailable", with why), not an error.
export function createStartGameRunOperation(
  getService: () => Promise<GameRunsService>,
) {
  return {
    access: { kind: "authenticated" },
    applicationErrors: ["unauthorized"],
    execute: async (input, context) => {
      if (context.actorUserId === null) return unauthenticated;
      const outcome = await (
        await getService()
      ).start(context.actorUserId, input.gameId);
      if (outcome.ok)
        return {
          ok: true,
          value: { ...outcome.run, status: "started" },
        } as const;
      return {
        ok: true,
        value: {
          reason:
            outcome.code === "unavailable"
              ? "not-supported"
              : "too-many-open-runs",
          status: "unavailable",
        },
      } as const;
    },
    idempotency: "none",
    input: "json",
    inputSchema: startGameRunInputSchema,
    outputSchema: startGameRunResponseSchema,
    ...startGameRunRoute,
  } satisfies HttpOperation<StartGameRunInput, StartGameRunResponse>;
}

const refusalOf = {
  "already-submitted": "already-submitted",
  expired: "expired",
  "not-found": "unknown-run",
  stale: "stale",
} as const;

// Submits the record of a run the player was issued. Every outcome is an answer: verified, rejected with the reason (the run
// is spent either way, so the seed is not reusable), or refused because nothing could be replayed. Only a caller with no
// session is an error.
export function createSubmitGameRunOperation(
  getService: () => Promise<GameRunsService>,
) {
  return {
    access: { kind: "authenticated" },
    applicationErrors: ["unauthorized"],
    execute: async (input, context) => {
      if (context.actorUserId === null) return unauthenticated;
      const outcome = await (
        await getService()
      ).submit(context.actorUserId, input.gameId, input.runId, input.record);
      if (!outcome.ok)
        return {
          ok: true,
          value: { reason: refusalOf[outcome.code], status: "refused" },
        } as const;
      const { earned, reason, status } = outcome.verdict;
      return {
        ok: true,
        value:
          status === "verified"
            ? { earned: [...earned], status }
            : { reason: reason ?? "rejected", status },
      } as const;
    },
    idempotency: "none",
    input: "json",
    inputSchema: submitGameRunInputSchema,
    outputSchema: submitGameRunResponseSchema,
    ...submitGameRunRoute,
  } satisfies HttpOperation<SubmitGameRunInput, SubmitGameRunResponse>;
}
