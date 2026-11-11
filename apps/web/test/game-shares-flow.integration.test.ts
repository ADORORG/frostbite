import { randomUUID } from "node:crypto";

import {
  authUsers,
  createDatabaseClient,
  createDatabasePool,
  gameMilestoneUnlocks,
  parseDatabaseEnvironment,
  runMigrations,
} from "@frostbite/database";
import {
  createCreateShareOperation,
  createRevokeShareOperation,
} from "@frostbite/feature-games/shares-operations";
import { sharesResolverFor } from "@frostbite/feature-games/shares-runtime";
import { correlationIdSchema } from "@frostbite/shared/http";
import { createUuidV7, uuidV7Schema } from "@frostbite/shared/identifiers";
import {
  afterAll,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vitest";

import { games } from "@repo/configs/games";
import { GET as shareImage } from "../src/app/s/[id]/share-image/route";

// Sharing as a player drives it, against real PostgreSQL and the platform's own listed games: make a link, open its picture, end it.
// The HTTP framing around the operations (session, origin, rate limit) is covered where it lives.
const environment = parseDatabaseEnvironment(process.env);
const pool = createDatabasePool(environment);
const database = createDatabaseClient(pool);
const game = games[0];
const milestone = game?.milestones[0];
if (game === undefined || milestone === undefined)
  throw new Error("The platform lists no game with a milestone.");
const resolver = sharesResolverFor(games);
const create = createCreateShareOperation(resolver);
const revoke = createRevokeShareOperation(resolver);
const sessionFor = (userId: string) => ({
  actorSession: null,
  actorUserId: uuidV7Schema.parse(userId),
  correlationId: correlationIdSchema.parse(randomUUID()),
});
const imageOf = (id: string) =>
  shareImage(new Request(`https://play.example.com/s/${id}/share-image`), {
    params: Promise.resolve({ id }),
  });

beforeAll(async () => {
  await runMigrations(environment);
});
afterAll(async () => pool.end());
beforeEach(() => {
  vi.stubEnv("APP_ENV", "test");
  vi.stubEnv("PUBLIC_BASE_URL", "https://play.example.com");
  vi.stubEnv("NEXT_PUBLIC_APP_NAME", "Frostbite");
});

async function player(
  withMilestone: "replay-verified" | "self-reported" | null,
) {
  const id = createUuidV7();
  await database
    .insert(authUsers)
    .values({ email: `${id}@example.test`, id, name: "Player" });
  if (withMilestone !== null)
    await database.insert(gameMilestoneUnlocks).values({
      count: 1,
      gameId: game!.id,
      milestoneId: milestone!.id,
      unlockedAt: new Date(),
      userId: id,
      verification: withMilestone,
    });
  return id;
}
const makeShare = async (
  userId: string,
  request: Parameters<typeof create.execute>[0],
) => {
  const answer = await create.execute(request, sessionFor(userId));
  if (!answer.ok || answer.value.status !== "shared")
    throw new Error(`The share was not made: ${JSON.stringify(answer)}`);
  return answer.value.id;
};

describe("sharing a milestone", () => {
  it("makes one link for the same thing, takes the level from the account, and gives it a picture", async () => {
    const user = await player("replay-verified");
    const request = {
      gameId: game!.id,
      kind: "milestone",
      milestoneId: milestone!.id,
    } as const;
    const id = await makeShare(user, request);
    expect(await makeShare(user, request)).toBe(id);
    expect(await (await resolver()).get(id)).toMatchObject({
      verification: "replay-verified",
    });
    const picture = await imageOf(id);
    expect(picture.status).toBe(200);
    expect(picture.headers.get("content-type")).toBe("image/png");
  });

  it("is refused for a milestone the account does not hold, and for one the game does not declare", async () => {
    const user = await player(null);
    const unearned = await create.execute(
      { gameId: game!.id, kind: "milestone", milestoneId: milestone!.id },
      sessionFor(user),
    );
    expect(unearned).toEqual({
      ok: true,
      value: { reason: "not-earned", status: "unavailable" },
    });
    const invented = await create.execute(
      { gameId: game!.id, kind: "milestone", milestoneId: "invented" },
      sessionFor(user),
    );
    expect(invented).toMatchObject({
      value: { reason: "unknown-milestone" },
    });
  });
});

describe("sharing a score and the case", () => {
  it("a score is self-reported and its picture names the game", async () => {
    const user = await player(null);
    const id = await makeShare(user, {
      gameId: game!.id,
      kind: "score",
      score: 4210,
    });
    expect(await (await resolver()).get(id)).toMatchObject({
      score: 4210,
      verification: "self-reported",
    });
    expect((await imageOf(id)).status).toBe(200);
  });

  it("the case needs no game and still has a picture", async () => {
    const id = await makeShare(await player(null), { kind: "milestones" });
    expect((await imageOf(id)).status).toBe(200);
  });
});

describe("ending a link", () => {
  it("is done by its owner alone, and the picture is gone with it", async () => {
    const [owner, other] = [await player(null), await player(null)];
    const id = await makeShare(owner, { kind: "milestones" });
    expect(await revoke.execute({ id }, sessionFor(other))).toEqual({
      ok: true,
      value: { revoked: false },
    });
    expect((await imageOf(id)).status).toBe(200);
    expect(await revoke.execute({ id }, sessionFor(owner))).toEqual({
      ok: true,
      value: { revoked: true },
    });
    expect((await imageOf(id)).status).toBe(404);
  });

  it("has no picture for a link that never was or is not an identifier", async () => {
    expect((await imageOf(randomUUID())).status).toBe(404);
    expect((await imageOf("not-an-id")).status).toBe(404);
  });
});
