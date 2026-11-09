import { beforeEach, describe, expect, it, vi } from "vitest";

const calls = vi.hoisted(() => ({
  pool: vi.fn(() => ({ pool: true })),
  record: vi.fn(),
  window: vi.fn(),
}));

vi.mock("@frostbite/database/connection", () => ({
  createDatabaseClient: (pool: unknown) => ({ client: pool }),
  createDatabasePool: calls.pool,
  parseDatabaseEnvironment: () => ({ parsed: true }),
}));
vi.mock("@frostbite/game-runs", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@frostbite/game-runs")>()),
  playsInWindow: calls.window,
  recordPlay: calls.record,
}));

import { createPlaysResolver, hotMaxAgeMs } from "../src/plays-runtime.ts";

let now = new Date("2026-11-11T15:00:00.000Z");
const clock = () => now;

beforeEach(() => {
  vi.clearAllMocks();
  now = new Date("2026-11-11T15:00:00.000Z");
  calls.window.mockResolvedValue([
    { gameId: "a", plays: 40 },
    { gameId: "b", plays: 10 },
    { gameId: "quiet", plays: 2 },
  ]);
});

describe("the runs started in each game, in the database", () => {
  it("counts a start on the day the clock is on, through the one pool", async () => {
    await (await createPlaysResolver(clock, {}).plays()).record("arcade");
    expect(calls.record).toHaveBeenCalledWith(
      { client: { pool: true } },
      "arcade",
      now,
    );
  });

  it("ranks the games played enough in the window, and leaves out the rest", async () => {
    const ranked = await createPlaysResolver(clock, {}).hot();
    expect(ranked.map(({ gameId }) => gameId)).toEqual(["a", "b"]);
    expect(ranked[0]).toMatchObject({ heat: 5, hot: true, rank: 1 });
    expect(calls.window).toHaveBeenCalledWith({ client: { pool: true } }, now);
  });

  it("reads the database once a minute however often the pages ask, and again after the minute", async () => {
    const { hot } = createPlaysResolver(clock, {});
    await hot();
    await hot();
    expect(calls.window).toHaveBeenCalledTimes(1);
    now = new Date(now.getTime() + hotMaxAgeMs);
    await hot();
    expect(calls.window).toHaveBeenCalledTimes(2);
  });

  it("shows none, and tries again, when the database cannot be read", async () => {
    calls.window.mockRejectedValueOnce(new Error("down"));
    const { hot } = createPlaysResolver(clock, {});
    expect(await hot()).toEqual([]);
    expect((await hot()).length).toBe(2);
  });
});
