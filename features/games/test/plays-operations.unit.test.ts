import { recordGamePlayResponseSchema } from "@frostbite/shared/games";
import { describe, expect, it, vi } from "vitest";

import {
  createRecordGamePlayOperation,
  type Plays,
} from "../src/application/plays-operations.ts";

const listed = new Set(["arcade"]);
const context = {} as Parameters<
  ReturnType<typeof createRecordGamePlayOperation>["execute"]
>[1];

describe("counting a run started in a game", () => {
  it("is open to anyone, a write, and answers in the contract's shape", async () => {
    const record = vi.fn(async () => undefined);
    const operation = createRecordGamePlayOperation(
      async (): Promise<Plays> => ({ record }),
      listed,
    );
    expect(operation.access).toEqual({ kind: "public" });
    expect(operation.method).toBe("POST");
    const answer = await operation.execute({ gameId: "arcade" }, context);
    expect(answer).toEqual({ ok: true, value: { counted: true } });
    expect(
      recordGamePlayResponseSchema.safeParse(answer.ok ? answer.value : null)
        .success,
    ).toBe(true);
    expect(record).toHaveBeenCalledExactlyOnceWith("arcade");
  });

  it("is not found for a game the platform does not list, and leaves nothing behind", async () => {
    const record = vi.fn(async () => undefined);
    const operation = createRecordGamePlayOperation(
      async (): Promise<Plays> => ({ record }),
      listed,
    );
    const answer = await operation.execute({ gameId: "made-up" }, context);
    expect(answer).toMatchObject({ error: "not_found", ok: false });
    expect(record).not.toHaveBeenCalled();
  });

  it("does not reach for the database until a listed game is counted", async () => {
    const getPlays = vi.fn(async (): Promise<Plays> => ({ record: vi.fn() }));
    const operation = createRecordGamePlayOperation(getPlays, listed);
    await operation.execute({ gameId: "made-up" }, context);
    expect(getPlays).not.toHaveBeenCalled();
  });
});
