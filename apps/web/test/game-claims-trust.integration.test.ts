import { randomUUID } from "node:crypto";

import {
  authUsers,
  createDatabaseClient,
  createDatabasePool,
  gameAdminSteps,
  gameContracts,
  gameMilestoneClaims,
  gameMilestoneUnlocks,
  parseDatabaseEnvironment,
  publishedTemplates,
  runMigrations,
} from "@frostbite/database";
import { writeRecording } from "@frostbite/database/game-contracts";
import { createStartGameClaimOperation } from "@frostbite/feature-games/claims-operations";
import { createGameClaimsResolver } from "@frostbite/feature-games/claims-runtime";
import { createSyncGameStateOperation } from "@frostbite/feature-games/sync-operation";
import { createGameSyncResolver } from "@frostbite/feature-games/runtime";
import { chainRefSchema } from "@frostbite/shared/chain";
import { defineGame } from "@frostbite/shared/games";
import { correlationIdSchema } from "@frostbite/shared/http";
import { uuidV7Schema } from "@frostbite/shared/identifiers";
import { createSimulatedChain } from "@frostbite/test-kit/simulated-chain";
import {
  nativeAsset,
  simulatedFamily,
} from "@frostbite/test-kit/simulated-chain-transaction";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

// A player (or a script posing as the game's page) can send the account any state it likes. What it sends is read as the game's own
// report, so a milestone the game's manifest says only a replay can prove must not become a claim on the strength of that report.
const environment = parseDatabaseEnvironment(process.env);
const pool = createDatabasePool(environment);
const database = createDatabaseClient(pool);
const chain = chainRefSchema.parse("simnet:one");
const gameId = "trust-game";
const wallet = "sim:one:a1b2c3fe";
const milestone = (id: string, verification?: "replay-verified") => ({
  claimPolicy: "once" as const,
  criteria: "Win.",
  description: "You won.",
  id,
  title: id,
  ...(verification === undefined ? {} : { verification }),
});
const game = defineGame({
  capabilities: ["milestone:claim", "run:submit"],
  description: "",
  id: gameId,
  launch: { mode: "embedded" },
  milestones: [milestone("reported"), milestone("proven", "replay-verified")],
  network: chain,
  rewards: { templateId: "game-rewards", templateVersion: "1.0.0" },
  schemaVersion: 1,
  summary: "A game.",
  tags: ["arcade"],
  title: "Trust game",
  verification: { replay: { id: "trust", sha256: "a".repeat(64), version: 1 } },
  version: "1",
});
const session = (userId: string) => ({
  actorSession: null,
  actorUserId: uuidV7Schema.parse(userId),
  correlationId: correlationIdSchema.parse(randomUUID()),
});
const now = new Date("2026-10-16T12:00:00.000Z");
const network = createSimulatedChain({ chains: [chain], now: () => now });
const claims = () => {
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
  return createStartGameClaimOperation(
    createGameClaimsResolver([game], {
      chain: () => ({
        funding: { maxFee: { asset: nativeAsset(chain), baseUnits: 10n } },
        ports: {
          addressCodec,
          broadcaster,
          builder,
          contracts,
          observer,
          rewards,
        },
      }),
      clock: () => now,
      delay: { maxLagBlocks: 2, maxUnsettledMs: 60 * 60_000 },
    }),
  );
};
const sync = createSyncGameStateOperation(createGameSyncResolver([game]));

async function player() {
  const random = randomUUID();
  const id = `0198a000-${random.slice(9, 13)}-7${random.slice(15, 18)}-8${random.slice(20, 23)}-${random.slice(24)}`;
  await database
    .insert(authUsers)
    .values({ email: `${id}@example.test`, id, name: "P" });
  return id;
}
// What a hostile page sends: every milestone, each claiming to be replay-verified.
const forged = (ids: readonly string[]) => ({
  gameId,
  state: {
    counters: [],
    milestones: ids.map((id) => ({
      count: 1,
      id,
      unlockedAt: now.toISOString(),
      verification: "replay-verified" as const,
    })),
    progress: null,
  },
});
const start = async (userId: string, milestoneId: string) =>
  claims().execute({ gameId, milestoneId, wallet }, session(userId));

beforeAll(async () => runMigrations(environment));
beforeEach(async () => {
  await database.delete(gameContracts);
  await database.delete(publishedTemplates);
  await database.delete(gameAdminSteps);
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
});
afterAll(async () => pool.end());

describe("what a claim trusts", () => {
  it("lets a milestone the game reports itself be claimed, as designed", async () => {
    const userId = await player();
    await sync.execute(forged(["reported"]), session(userId));
    const result = await start(userId, "reported");
    expect(result.ok && result.value.status).toBe("started");
  });

  it("does not let a forged 'replay-verified' report start a claim on a milestone only a replay can prove", async () => {
    const userId = await player();
    const synced = await sync.execute(forged(["proven"]), session(userId));
    // The account holds it, but only as the game's report, whatever level the request named.
    expect(synced.ok && synced.value.milestones[0]?.verification).toBe(
      "self-reported",
    );
    const result = await start(userId, "proven");
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

  it("lets the same milestone be claimed once the platform's own replay has verified it", async () => {
    const userId = await player();
    await database.insert(gameMilestoneUnlocks).values({
      count: 1,
      gameId,
      milestoneId: "proven",
      unlockedAt: now,
      userId,
      verification: "replay-verified",
    });
    const result = await start(userId, "proven");
    expect(result.ok && result.value.status).toBe("started");
  });
});
