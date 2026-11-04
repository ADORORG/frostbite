import { randomUUID } from "node:crypto";

import {
  authUsers,
  createDatabaseClient,
  gameAdminSteps,
  gameContracts,
  publishedTemplates,
  createDatabasePool,
  gameMilestoneClaims,
  gameMilestoneUnlocks,
  parseDatabaseEnvironment,
  runMigrations,
} from "@ador/database";
import { writeRecording } from "@ador/database/game-contracts";
import {
  createListGameClaimsOperation,
  createRefreshGameClaimOperation,
  createStartGameClaimOperation,
  createSubmitGameClaimOperation,
} from "@ador/feature-games/claims-operations";
import { createGameClaimsResolver } from "@ador/feature-games/claims-runtime";
import { chainRefSchema } from "@ador/shared/chain";
import { defineGame, type GameClaim } from "@ador/shared/games";
import { correlationIdSchema } from "@ador/shared/http";
import { uuidV7Schema } from "@ador/shared/identifiers";
import { createSimulatedChain } from "@ador/test-kit/simulated-chain";
import {
  nativeAsset,
  simulatedFamily,
} from "@ador/test-kit/simulated-chain-transaction";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

// The claim path as the page drives it, against real PostgreSQL and the simulated chain, with a game the platform has never
// heard of that declares a rewards contract: start, sign, send, watch until complete. Only the HTTP framing around the four
// operations is left out (the route's session, origin and rate limit are covered where they live).
const environment = parseDatabaseEnvironment(process.env);
const pool = createDatabasePool(environment);
const database = createDatabaseClient(pool);
const chain = chainRefSchema.parse("simnet:one");
const gameId = "claim-game";
const wallet = "sim:one:a1b2c3fe";
const game = defineGame({
  capabilities: ["milestone:claim"],
  description: "",
  id: gameId,
  launch: { mode: "embedded" },
  milestones: [
    {
      claimPolicy: "once",
      criteria: "Win.",
      description: "You won.",
      id: "first-win",
      title: "First win",
    },
  ],
  network: chain,
  rewards: { templateId: "game-rewards", templateVersion: "1.0.0" },
  schemaVersion: 1,
  summary: "A game.",
  tags: ["arcade"],
  title: "Claim game",
  version: "1",
});
const sessionFor = (userId: string | null) => ({
  actorSession: null,
  actorUserId: userId === null ? null : uuidV7Schema.parse(userId),
  correlationId: correlationIdSchema.parse(randomUUID()),
});

let now = new Date("2026-10-16T12:00:00.000Z");
let network = createSimulatedChain({ chains: [chain], now: () => now });
const ports = () => {
  const { addressCodec, broadcaster, builder, contracts, observer, rewards } =
    network.adapter.ports;
  if (
    !addressCodec ||
    !broadcaster ||
    !builder ||
    !contracts ||
    !observer ||
    !rewards
  )
    throw new Error("The simulated adapter lacks a port.");
  return { addressCodec, broadcaster, builder, contracts, observer, rewards };
};
const configured = () => ({
  clock: () => now,
  delay: { maxLagBlocks: 2, maxUnsettledMs: 60 * 60_000 },
  chain: () => ({
    funding: { maxFee: { asset: nativeAsset(chain), baseUnits: 10n } },
    ports: ports(),
  }),
});
// The game's contract on record, as the step that created it left it: nothing is configured, so a game has a contract only once
// that step completed.
async function recordContract() {
  const id = randomUUID();
  await database.insert(gameAdminSteps).values({
    chain,
    expiresAt: now,
    gameId,
    id,
    operation: "deploy",
    state: "awaiting_signature",
    summary: {},
    unsignedFamily: simulatedFamily,
    unsignedFormat: "f",
    unsignedPayload: "p",
  });
  await writeRecording(
    database,
    { chain, id },
    {
      address: "rewards-1",
      family: simulatedFamily,
      gameId,
      kind: "game",
      maxDrawingBytes: 4096,
    },
  );
}
const operations = () => {
  const resolver = createGameClaimsResolver([game], configured());
  return {
    list: createListGameClaimsOperation(resolver),
    refresh: createRefreshGameClaimOperation(resolver),
    start: createStartGameClaimOperation(resolver),
    submit: createSubmitGameClaimOperation(resolver),
  };
};

async function seedPlayer(earned = true) {
  const random = randomUUID();
  const id = `0198a000-${random.slice(9, 13)}-7${random.slice(15, 18)}-8${random.slice(20, 23)}-${random.slice(24)}`;
  await database
    .insert(authUsers)
    .values({ email: `${id}@example.test`, id, name: "Player" });
  if (earned)
    await database.insert(gameMilestoneUnlocks).values({
      count: 1,
      gameId,
      milestoneId: "first-win",
      unlockedAt: now,
      userId: id,
      verification: "self-reported",
    });
  return id;
}
const input = { gameId, milestoneId: "first-win", wallet };
// The wallet's part: the simulated wallet signs by appending its marker to what it was shown.
const sign = (toSign: NonNullable<GameClaim["toSign"]>) => ({
  ...toSign,
  payload: `${toSign.payload}.sig`,
});

beforeAll(async () => runMigrations(environment));
beforeEach(async () => {
  now = new Date("2026-10-16T12:00:00.000Z");
  network = createSimulatedChain({ chains: [chain], now: () => now });
  await database.delete(gameContracts);
  await database.delete(publishedTemplates);
  await database.delete(gameAdminSteps);
  await recordContract();
});
afterAll(async () => pool.end());

describe("claiming a milestone through the operations", () => {
  it("goes from earned to complete, the player's own wallet signing what they were shown", async () => {
    const userId = await seedPlayer();
    const { list, refresh, start, submit } = operations();
    const session = sessionFor(userId);

    const started = await start.execute(input, session);
    if (!started.ok || started.value.status !== "started")
      throw new Error("not started");
    const { claim } = started.value;
    expect(claim).toMatchObject({
      gameId,
      milestoneId: "first-win",
      state: "awaiting-signature",
      summary: { contractId: "rewards-1", recipient: wallet },
    });
    if (claim.toSign === null) throw new Error("nothing to sign");

    const signed = sign(claim.toSign);
    expect(signed.payload).toBe(`${claim.toSign.payload}.sig`);
    const submitted = await submit.execute(
      { claimId: claim.id, signed },
      session,
    );
    expect(submitted).toMatchObject({
      value: { claim: { state: "pending" }, status: "submitted" },
    });

    network.controls.advance(chain, 3);
    const states: string[] = [];
    for (let look = 0; look < 3; look += 1) {
      const looked = await refresh.execute({ claimId: claim.id }, session);
      states.push(
        looked.ok && looked.value.status === "ok"
          ? looked.value.claim.state
          : "refused",
      );
    }
    expect(states).toEqual(["claimed", "complete", "complete"]);
    const listed = await list.execute({ gameId }, session);
    expect(listed.ok && listed.value.claims.map(({ state }) => state)).toEqual([
      "complete",
    ]);
    expect(
      (await database.select().from(gameMilestoneClaims)).filter(
        (row) => row.userId === userId,
      ),
    ).toHaveLength(1);
  });

  it("answers, for a milestone the player has not earned, that it is not earned, and writes nothing", async () => {
    const userId = await seedPlayer(false);
    const result = await operations().start.execute(input, sessionFor(userId));
    expect(result).toEqual({
      ok: true,
      value: { reason: "not-earned", status: "unavailable" },
    });
    expect(
      (await database.select().from(gameMilestoneClaims)).filter(
        (row) => row.userId === userId,
      ),
    ).toEqual([]);
  });

  it("answers that claims are not supported for a game with no contract on record, however well earned", async () => {
    const userId = await seedPlayer();
    await database.delete(gameContracts);
    expect(await operations().start.execute(input, sessionFor(userId))).toEqual(
      {
        ok: true,
        value: { reason: "not-supported", status: "unavailable" },
      },
    );
  });

  it("answers wrong network for a wallet address that is not on the game's chain", async () => {
    const userId = await seedPlayer();
    expect(
      await operations().start.execute(
        { ...input, wallet: "bc1qnotsimulated" },
        sessionFor(userId),
      ),
    ).toEqual({
      ok: true,
      value: { reason: "wrong-network", status: "unavailable" },
    });
  });

  it("does not show another player's claim, or let them sign it", async () => {
    const owner = await seedPlayer();
    const other = await seedPlayer();
    const { refresh, start, submit } = operations();
    const started = await start.execute(input, sessionFor(owner));
    if (!started.ok || started.value.status !== "started")
      throw new Error("not started");
    const { claim } = started.value;
    if (claim.toSign === null) throw new Error("nothing to sign");
    expect(
      await refresh.execute({ claimId: claim.id }, sessionFor(other)),
    ).toEqual({
      ok: true,
      value: { reason: "not-found", status: "refused" },
    });
    expect(
      await submit.execute(
        {
          claimId: claim.id,
          signed: sign(claim.toSign),
        },
        sessionFor(other),
      ),
    ).toEqual({ ok: true, value: { reason: "not-found", status: "refused" } });
  });

  it("refuses a caller with no session", async () => {
    const { start } = operations();
    expect(await start.execute(input, sessionFor(null))).toMatchObject({
      error: "unauthorized",
      ok: false,
    });
  });
});
