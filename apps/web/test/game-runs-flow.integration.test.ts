import { randomUUID } from "node:crypto";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import {
  authUsers,
  createDatabaseClient,
  createDatabasePool,
  gameMilestoneUnlocks,
  gameRuns,
  parseDatabaseEnvironment,
  runMigrations,
} from "@frostbite/database";
import {
  createStartGameRunOperation,
  createSubmitGameRunOperation,
} from "@frostbite/feature-games/runs-operations";
import { createGameRunsResolver } from "@frostbite/feature-games/runs-runtime";
import { correlationIdSchema } from "@frostbite/shared/http";
import { uuidV7Schema } from "@frostbite/shared/identifiers";
import {
  adderManifest,
  adderMilestone,
  adderRecord,
  publishAdderGame,
} from "@frostbite/test-kit/adder-game";
import {
  afterAll,
  afterEach,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vitest";

// The whole claim path against real PostgreSQL, with a game the platform has never heard of: its rules built by the SDK, its
// digest pinned in a manifest, its file served from a folder. Only the HTTP framing around the two operations is left out
// (the route's session, origin and rate limit are covered where they live).
const environment = parseDatabaseEnvironment(process.env);
const pool = createDatabasePool(environment);
const database = createDatabaseClient(pool);
const gameId = "adder-game";
let scratch = "";
let resolver: ReturnType<typeof createGameRunsResolver>;
let start: ReturnType<typeof createStartGameRunOperation>;
let submit: ReturnType<typeof createSubmitGameRunOperation>;

const sessionFor = (userId: string | null) => ({
  actorSession: null,
  actorUserId: userId === null ? null : uuidV7Schema.parse(userId),
  correlationId: correlationIdSchema.parse(randomUUID()),
});

async function seedPlayer() {
  // The session carries a version 7 id; the rest of this one is random.
  const random = randomUUID();
  const id = `0198a000-${random.slice(9, 13)}-7${random.slice(15, 18)}-8${random.slice(20, 23)}-${random.slice(24)}`;
  await database
    .insert(authUsers)
    .values({ email: `${id}@example.test`, id, name: "Player" });
  return id;
}

async function startRun(userId: string) {
  const outcome = await start.execute({ gameId }, sessionFor(userId));
  if (!outcome.ok || outcome.value.status !== "started")
    throw new Error("The run did not start.");
  return outcome.value;
}

const milestonesOf = async (userId: string) =>
  (await database.select().from(gameMilestoneUnlocks)).filter(
    (row) => row.userId === userId,
  );

beforeAll(async () => runMigrations(environment));
beforeEach(async () => {
  scratch = await mkdtemp(join(tmpdir(), "runs-flow-"));
  const built = await publishAdderGame(scratch, gameId);
  resolver = createGameRunsResolver(
    [adderManifest(gameId, built.sha256)],
    { playRoot: join(scratch, "play") },
    process.env,
  );
  start = createStartGameRunOperation(resolver);
  submit = createSubmitGameRunOperation(resolver);
});
afterEach(async () => rm(scratch, { force: true, recursive: true }));
afterAll(async () => pool.end());

describe("starting and submitting a replay-verified run", () => {
  it("replays a legal record from the issued seed, and puts the milestone on the account as replay-verified", async () => {
    const userId = await seedPlayer();
    const run = await startRun(userId);
    expect(run.seed).toBeGreaterThanOrEqual(0);
    const outcome = await submit.execute(
      {
        gameId,
        record: adderRecord(gameId, run.seed, [1, 2]),
        runId: run.runId,
      },
      sessionFor(userId),
    );
    expect(outcome).toEqual({
      ok: true,
      value: { earned: [adderMilestone], status: "verified" },
    });
    expect(await milestonesOf(userId)).toMatchObject([
      { milestoneId: adderMilestone, verification: "replay-verified" },
    ]);
    const stored = (await database.select().from(gameRuns)).find(
      ({ id }) => id === run.runId,
    );
    expect(stored).toMatchObject({ state: "submitted", verdict: "verified" });
    expect(stored?.recordText).toContain('"verifier":"adder"');
  });

  it("settles a run once: the same record again, or another, is refused and changes nothing", async () => {
    const userId = await seedPlayer();
    const run = await startRun(userId);
    const input = {
      gameId,
      record: adderRecord(gameId, run.seed, [3]),
      runId: run.runId,
    };
    expect((await submit.execute(input, sessionFor(userId))).ok).toBe(true);
    expect(await submit.execute(input, sessionFor(userId))).toEqual({
      ok: true,
      value: { reason: "already-submitted", status: "refused" },
    });
    expect(await milestonesOf(userId)).toHaveLength(1);
  });

  it("rejects a record the replay does not support, spends the run, and grants nothing", async () => {
    const userId = await seedPlayer();
    const cases = [
      ["claims what the run did not earn", [1], undefined, "claim-not-earned"],
      [
        "adds something that is not a number",
        ["x"],
        undefined,
        "illegal-input",
      ],
      [
        "claims a milestone the manifest does not declare",
        [3],
        ["invented"],
        "claim-not-verifiable",
      ],
    ] as const;
    for (const [, adds, claims, reason] of cases) {
      const run = await startRun(userId);
      const outcome = await submit.execute(
        {
          gameId,
          record: adderRecord(gameId, run.seed, adds, claims),
          runId: run.runId,
        },
        sessionFor(userId),
      );
      expect(outcome).toEqual({
        ok: true,
        value: { reason, status: "rejected" },
      });
    }
    expect(await milestonesOf(userId)).toEqual([]);
  });

  it("rejects a record made for another seed, without letting the player choose the board", async () => {
    const userId = await seedPlayer();
    const run = await startRun(userId);
    const outcome = await submit.execute(
      {
        gameId,
        record: adderRecord(gameId, (run.seed + 1) % 4_294_967_296, [3]),
        runId: run.runId,
      },
      sessionFor(userId),
    );
    expect(outcome).toMatchObject({
      ok: true,
      value: { reason: "seed-mismatch", status: "rejected" },
    });
    expect(await milestonesOf(userId)).toEqual([]);
  });

  it("will not settle another player's run, and says the run does not exist", async () => {
    const owner = await seedPlayer();
    const other = await seedPlayer();
    const run = await startRun(owner);
    expect(
      await submit.execute(
        {
          gameId,
          record: adderRecord(gameId, run.seed, [3]),
          runId: run.runId,
        },
        sessionFor(other),
      ),
    ).toEqual({
      ok: true,
      value: { reason: "unknown-run", status: "refused" },
    });
    expect(await milestonesOf(other)).toEqual([]);
  });

  it("limits the runs a player may hold open, by the policy", async () => {
    const userId = await seedPlayer();
    for (let count = 0; count < 3; count += 1) await startRun(userId);
    expect(await start.execute({ gameId }, sessionFor(userId))).toEqual({
      ok: true,
      value: { reason: "too-many-open-runs", status: "unavailable" },
    });
  });

  it("refuses an anonymous caller, and a game with no verifier the platform could load", async () => {
    expect(await start.execute({ gameId }, sessionFor(null))).toMatchObject({
      error: "unauthorized",
    });
    expect(
      await submit.execute(
        { gameId, record: {}, runId: randomUUID() },
        sessionFor(null),
      ),
    ).toMatchObject({ error: "unauthorized" });
    const userId = await seedPlayer();
    expect(
      await start.execute({ gameId: "no-such-game" }, sessionFor(userId)),
    ).toEqual({
      ok: true,
      value: { reason: "not-supported", status: "unavailable" },
    });
  });

  it("leaves a game self-reported, and says why in the log, when its verifier file is not served", async () => {
    const logged = vi.spyOn(console, "error").mockImplementation(() => {});
    const missing = createStartGameRunOperation(
      createGameRunsResolver(
        [adderManifest(gameId, "f".repeat(64))],
        { playRoot: join(scratch, "nowhere") },
        process.env,
      ),
    );
    const userId = await seedPlayer();
    expect(await missing.execute({ gameId }, sessionFor(userId))).toEqual({
      ok: true,
      value: { reason: "not-supported", status: "unavailable" },
    });
    expect(logged).toHaveBeenCalledWith(
      expect.stringContaining(
        `game verifier ${gameId} not loaded (missing-artifact)`,
      ),
    );
    logged.mockRestore();
  });
});
