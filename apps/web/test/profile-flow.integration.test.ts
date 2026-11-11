import { randomUUID } from "node:crypto";

import {
  authUsers,
  createDatabaseClient,
  createDatabasePool,
  gameRuns,
  parseDatabaseEnvironment,
  runMigrations,
} from "@frostbite/database";
import {
  createCheckProfileNameOperation,
  createDeleteProfileOperation,
  createGetMyProfileOperation,
  createSaveProfileOperation,
} from "@frostbite/feature-profiles/profile-operations";
import { createGetPublicProfileOperation } from "@frostbite/feature-profiles/public-operation";
import { createProfilesResolver } from "@frostbite/feature-profiles/runtime";
import { correlationIdSchema } from "@frostbite/shared/http";
import { createUuidV7, uuidV7Schema } from "@frostbite/shared/identifiers";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { profilePolicy } from "@repo/configs/profiles";
import { games } from "@repo/configs/games";

// A player's profile as they drive it, against real PostgreSQL and the platform's own policy and listed games: make it, check names, change it,
// see their verified scores on the public page, hide it and take it down. The HTTP framing around the operations (session, origin, rate limit)
// is covered where it lives.
const environment = parseDatabaseEnvironment(process.env);
const pool = createDatabasePool(environment);
const database = createDatabaseClient(pool);
const game = games[0];
if (game === undefined) throw new Error("The platform lists no game.");
const resolver = createProfilesResolver(
  profilePolicy,
  new Set(games.map(({ id }) => id)),
);
const service = async () => (await resolver()).service;
const mine = createGetMyProfileOperation(service);
const check = createCheckProfileNameOperation(service);
const save = createSaveProfileOperation(service);
const remove = createDeleteProfileOperation(service);
const open = createGetPublicProfileOperation(resolver);
const sessionFor = (userId: string) => ({
  actorSession: null,
  actorUserId: uuidV7Schema.parse(userId),
  correlationId: correlationIdSchema.parse(randomUUID()),
});

beforeAll(async () => {
  await runMigrations(environment);
});
afterAll(async () => pool.end());

async function player() {
  const id = createUuidV7();
  await database
    .insert(authUsers)
    .values({ email: `${id}@example.test`, id, name: "Player" });
  return id;
}
const unique = () => `Flow${randomUUID().slice(0, 8).replaceAll("-", "")}`;

describe("a player's profile, end to end", () => {
  it("is made, found by name in any case, and shows verified scores the platform's replay reached and nothing else", async () => {
    const [id, name] = [await player(), unique()];
    expect(await mine.execute({}, sessionFor(id))).toMatchObject({
      value: { profile: null },
    });
    expect(
      await save.execute(
        { avatar: "dragon", name, visible: true },
        sessionFor(id),
      ),
    ).toMatchObject({
      value: { profile: { name, visible: true }, status: "saved" },
    });
    await database.insert(gameRuns).values([
      {
        expiresAt: new Date(Date.now() + 1000),
        gameId: game.id,
        id: randomUUID(),
        issuedAt: new Date(),
        score: 4210,
        seed: 1,
        state: "submitted",
        submittedAt: new Date(),
        userId: id,
        verdict: "verified",
        verifierDigest: "a".repeat(64),
      },
      {
        expiresAt: new Date(Date.now() + 1000),
        gameId: game.id,
        id: randomUUID(),
        issuedAt: new Date(),
        score: null,
        seed: 2,
        state: "submitted",
        submittedAt: new Date(),
        userId: id,
        verdict: "rejected",
        verifierDigest: "a".repeat(64),
      },
    ]);
    const page = await open.execute({ name: name.toUpperCase() });
    expect(page).toMatchObject({
      ok: true,
      value: {
        avatar: "dragon",
        bests: [{ gameId: game.id, score: 4210 }],
        mints: [],
        name,
      },
    });
    expect(JSON.stringify(page)).not.toContain(id);
  });

  it("holds a name for one player: a second is told it is taken, whether they ask first or save", async () => {
    const [first, second, name] = [await player(), await player(), unique()];
    await save.execute(
      { avatar: "fox", name, visible: false },
      sessionFor(first),
    );
    expect(await check.execute({ name }, sessionFor(second))).toEqual({
      ok: true,
      value: { status: "taken" },
    });
    expect(
      await save.execute(
        { avatar: "fox", name: name.toUpperCase(), visible: true },
        sessionFor(second),
      ),
    ).toMatchObject({
      value: { refusal: "name-taken", status: "refused" },
    });
  });

  it("refuses a name the platform's policy blocks, even with look-alike digits", async () => {
    const id = await player();
    expect(
      await save.execute(
        { avatar: "fox", name: "Adm1n", visible: true },
        sessionFor(id),
      ),
    ).toMatchObject({
      value: { reason: "blocked", refusal: "name-invalid" },
    });
    expect(
      await check.execute({ name: "the_staff" }, sessionFor(id)),
    ).toMatchObject({
      value: { reason: "blocked", status: "invalid" },
    });
  });

  it("does not let a name change again within the cooldown, and says when it can", async () => {
    const [id, name] = [await player(), unique()];
    await save.execute({ avatar: "fox", name, visible: true }, sessionFor(id));
    const answer = await save.execute(
      { avatar: "fox", name: unique(), visible: true },
      sessionFor(id),
    );
    expect(answer).toMatchObject({
      value: { refusal: "name-locked", status: "refused" },
    });
    expect(
      answer.ok && answer.value.status === "refused"
        ? answer.value.until
        : null,
    ).not.toBeNull();
    expect(
      await save.execute(
        { avatar: "owl", name, visible: true },
        sessionFor(id),
      ),
    ).toMatchObject({
      value: { profile: { avatar: "owl" }, status: "saved" },
    });
  });

  it("disappears from the public page when switched off or taken down, and the name is freed by taking it down", async () => {
    const [id, other, name] = [await player(), await player(), unique()];
    await save.execute({ avatar: "fox", name, visible: true }, sessionFor(id));
    await save.execute({ avatar: "fox", name, visible: false }, sessionFor(id));
    expect((await open.execute({ name })).ok).toBe(false);
    expect(await check.execute({ name }, sessionFor(other))).toEqual({
      ok: true,
      value: { status: "taken" },
    });
    expect(await remove.execute({}, sessionFor(id))).toEqual({
      ok: true,
      value: { deleted: true },
    });
    expect(await check.execute({ name }, sessionFor(other))).toEqual({
      ok: true,
      value: { status: "available" },
    });
  });
});
