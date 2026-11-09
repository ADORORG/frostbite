import type { HttpOperation } from "@frostbite/http";
import { failure } from "@frostbite/http/outcome";
import {
  recordGamePlayInputSchema,
  recordGamePlayResponseSchema,
  recordGamePlayRoute,
  type RecordGamePlayInput,
  type RecordGamePlayResponse,
} from "@frostbite/shared/games";

// What the games feature needs to count a start; the database-backed answer is made in `plays-runtime.ts`.
export interface Plays {
  record(gameId: string): Promise<void>;
}

// Counts one run started in a game. Anyone may call it, signed in or not, and it names no one: the rate limit of this operation is what keeps a
// visitor from raising a count. A game the platform does not list is "not found", so a made-up name leaves no row behind.
export function createRecordGamePlayOperation(
  getPlays: () => Promise<Plays>,
  listed: ReadonlySet<string>,
) {
  return {
    access: { kind: "public" },
    applicationErrors: ["not_found"],
    execute: async (input) => {
      if (!listed.has(input.gameId))
        return failure("not_found", "No such game.");
      await (await getPlays()).record(input.gameId);
      return { ok: true, value: { counted: true } } as const;
    },
    idempotency: "none",
    input: "json",
    inputSchema: recordGamePlayInputSchema,
    outputSchema: recordGamePlayResponseSchema,
    ...recordGamePlayRoute,
  } satisfies HttpOperation<RecordGamePlayInput, RecordGamePlayResponse>;
}
