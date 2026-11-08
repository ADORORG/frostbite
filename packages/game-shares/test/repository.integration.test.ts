import { randomUUID } from "node:crypto";

import { gameShares } from "@frostbite/database";
import { eq, sql } from "drizzle-orm";
import { describe, expect, it } from "vitest";

import type { SharedThing } from "../src/repository.ts";
import {
  database,
  now,
  registerDatabase,
  repository,
  seedUser,
} from "./share-database.ts";

registerDatabase();

const score = (value: number): SharedThing => ({
  gameId: "arcade",
  kind: "score",
  score: value,
  verification: "self-reported",
});
const milestone: SharedThing = {
  gameId: "arcade",
  kind: "milestone",
  milestoneId: "first-win",
  verification: "replay-verified",
};
const make = (userId: string, thing: SharedThing) => ({
  createdAt: now,
  id: randomUUID(),
  thing,
  userId,
});

describe("making a share", () => {
  it.each([
    ["a score", score(900)],
    ["a milestone", milestone],
    [
      "a milestone known only as reported",
      {
        ...milestone,
        milestoneId: "second",
        verification: "self-reported",
      } as const,
    ],
    ["the case", { kind: "milestones" } as const],
  ])("stores %s and reads it back as the same thing", async (_name, thing) => {
    const user = await seedUser();
    const share = await repository.createOrGet(make(user, thing));
    expect(share.thing).toEqual(thing);
    expect((await repository.get(share.id))?.thing).toEqual(thing);
  });

  it("gives the same link for the same thing, even when asked together", async () => {
    const user = await seedUser();
    const asked = await Promise.all(
      Array.from({ length: 6 }, () =>
        repository.createOrGet(make(user, score(321))),
      ),
    );
    expect(new Set(asked.map((share) => share.id)).size).toBe(1);
    const rows = await database
      .select()
      .from(gameShares)
      .where(eq(gameShares.userId, user));
    expect(rows).toHaveLength(1);
  });

  it("keeps different things, other scores and other players apart", async () => {
    const [one, two] = [await seedUser(), await seedUser()];
    const ids = await Promise.all(
      [
        make(one, score(1)),
        make(one, score(2)),
        make(one, milestone),
        make(two, score(1)),
      ].map(async (share) => (await repository.createOrGet(share)).id),
    );
    expect(new Set(ids).size).toBe(4);
  });

  it("holds a score beyond what a 32-bit number holds, exactly", async () => {
    const user = await seedUser();
    const big = Number.MAX_SAFE_INTEGER;
    const share = await repository.createOrGet(make(user, score(big)));
    expect(share.thing).toMatchObject({ score: big });
  });
});

describe("ending a share", () => {
  it("answers as if it never existed once its owner revokes it, and lets the thing be shared again as a new link", async () => {
    const user = await seedUser();
    const first = await repository.createOrGet(make(user, score(77)));
    expect(await repository.revoke(user, first.id, now)).toBe(true);
    expect(await repository.get(first.id)).toBeNull();
    expect(await repository.revoke(user, first.id, now)).toBe(false);
    const again = await repository.createOrGet(make(user, score(77)));
    expect(again.id).not.toBe(first.id);
  });

  it("cannot be ended by anyone but its owner", async () => {
    const [owner, other] = [await seedUser(), await seedUser()];
    const share = await repository.createOrGet(make(owner, score(5)));
    expect(await repository.revoke(other, share.id, now)).toBe(false);
    expect(await repository.get(share.id)).not.toBeNull();
  });

  it("goes with its owner when the account is deleted", async () => {
    const user = await seedUser();
    const share = await repository.createOrGet(make(user, score(8)));
    await database.execute(
      sql`delete from frostbite.auth_users where id = ${user}`,
    );
    expect(await repository.get(share.id)).toBeNull();
  });
});

describe("what the table refuses", () => {
  it("a score marked verified, a negative score, and a case that names a game", async () => {
    const user = await seedUser();
    const row = { createdAt: now, userId: user };
    const refused = (values: object) =>
      database
        .insert(gameShares)
        .values({ id: randomUUID(), ...row, ...values } as never)
        .then(
          () => false,
          () => true,
        );
    expect(
      await refused({
        gameId: "arcade",
        kind: "score",
        score: 1,
        verification: "replay-verified",
      }),
    ).toBe(true);
    expect(
      await refused({
        gameId: "arcade",
        kind: "score",
        score: -1,
        verification: "self-reported",
      }),
    ).toBe(true);
    expect(await refused({ gameId: "arcade", kind: "milestones" })).toBe(true);
  });
});
