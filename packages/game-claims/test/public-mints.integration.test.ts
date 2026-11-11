import { gameMilestoneClaims, gameMilestoneUnlocks } from "@frostbite/database";
import { describe, expect, it } from "vitest";

import { createPublicMints } from "../src/public-mints.ts";
import { claim, sentAt } from "./support/claim-rows.ts";
import { database, registerDatabase, seedUser } from "./support/fixture.ts";

registerDatabase();
const gallery = createPublicMints(database);
let counter = 0;
const freshGame = () => `gallery-game-${String((counter += 1))}`;
const earned = (
  userId: string,
  gameId: string,
  milestoneId: string,
  level: string,
) =>
  database.insert(gameMilestoneUnlocks).values({
    count: 1,
    gameId,
    milestoneId,
    unlockedAt: sentAt,
    userId,
    verification: level,
  });

describe("a game's public mints", () => {
  it("lists completed mints newest first with how each was known, and nothing that is not complete", async () => {
    const gameId = freshGame();
    const [verified, reported] = [await seedUser(), await seedUser()];
    await earned(verified, gameId, "first-win", "replay-verified");
    await earned(reported, gameId, "streak", "self-reported");
    await database.insert(gameMilestoneClaims).values([
      claim(verified, gameId, "complete", {
        milestoneId: "first-win",
        updatedAt: new Date(sentAt.getTime() + 2_000),
      }),
      claim(reported, gameId, "complete", {
        milestoneId: "streak",
        updatedAt: new Date(sentAt.getTime() + 1_000),
      }),
      claim(reported, gameId, "signed", { milestoneId: "other" }),
      claim(reported, gameId, "expired", { milestoneId: "never" }),
    ]);
    const { mints, next } = await gallery.page(gameId, 10);
    expect(
      mints.map(({ milestoneId, verification }) => [milestoneId, verification]),
    ).toEqual([
      ["first-win", "replay-verified"],
      ["streak", "self-reported"],
    ]);
    expect(next).toBeNull();
    expect(mints[0]?.wallet).toMatch(/^sim:/u);
    expect(JSON.stringify(mints)).not.toContain(verified);
  });

  it("calls a mint self-reported when the account has no record of how it was earned", async () => {
    const gameId = freshGame();
    const user = await seedUser();
    await database
      .insert(gameMilestoneClaims)
      .values(claim(user, gameId, "complete", { milestoneId: "lost" }));
    expect((await gallery.page(gameId, 10)).mints[0]?.verification).toBe(
      "self-reported",
    );
  });

  it("pages to the end, each mint once, and is empty for a game with none", async () => {
    const gameId = freshGame();
    const user = await seedUser();
    await database.insert(gameMilestoneClaims).values(
      Array.from({ length: 5 }, (_unused, at) =>
        claim(user, gameId, "complete", {
          milestoneId: `m${String(at)}`,
          updatedAt: new Date(sentAt.getTime() + at * 1_000),
        }),
      ),
    );
    const seen: string[] = [];
    let page = await gallery.page(gameId, 2);
    for (;;) {
      seen.push(...page.mints.map(({ milestoneId }) => milestoneId));
      if (page.next === null) break;
      page = await gallery.page(gameId, 2, page.next);
    }
    expect(seen).toEqual(["m4", "m3", "m2", "m1", "m0"]);
    expect((await gallery.page(freshGame(), 5)).mints).toEqual([]);
  });

  it("counts mints per milestone and knows whose completed claim a picture belongs to", async () => {
    const gameId = freshGame();
    const user = await seedUser();
    const done = claim(user, gameId, "complete", { milestoneId: "first-win" });
    const waiting = claim(user, gameId, "signed", { milestoneId: "streak" });
    await database.insert(gameMilestoneClaims).values([done, waiting]);
    expect(await gallery.counts(gameId)).toEqual(new Map([["first-win", 1]]));
    expect(await gallery.owner(String(done.id))).toEqual({
      gameId,
      milestoneId: "first-win",
      userId: user,
    });
    expect(await gallery.owner(String(waiting.id))).toBeNull();
    expect(
      await gallery.owner("00000000-0000-4000-8000-000000000000"),
    ).toBeNull();
  });
});
