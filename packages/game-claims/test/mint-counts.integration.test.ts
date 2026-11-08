import { gameMilestoneClaims } from "@frostbite/database";
import { describe, expect, it } from "vitest";

import { claim } from "./support/claim-rows.ts";
import {
  database,
  registerDatabase,
  repository,
  seedUser,
  service,
} from "./support/fixture.ts";

registerDatabase();

let counter = 0;
// Each test counts a game of its own: the database lasts for the whole file.
const freshGame = () => `count-game-${String((counter += 1))}`;

describe("how many players minted each milestone", () => {
  it("counts completed claims per milestone, across players, and nothing that is not complete", async () => {
    const gameId = freshGame();
    const [one, two] = [await seedUser(), await seedUser()];
    await database
      .insert(gameMilestoneClaims)
      .values([
        claim(one, gameId, "complete", { milestoneId: "first-win" }),
        claim(two, gameId, "complete", { milestoneId: "first-win" }),
        claim(one, gameId, "complete", { milestoneId: "streak" }),
        claim(two, gameId, "signed", { milestoneId: "streak" }),
        claim(two, gameId, "expired", { milestoneId: "never" }),
        claim(one, freshGame(), "complete", { milestoneId: "first-win" }),
      ]);
    expect(await repository.completeCounts(gameId)).toEqual(
      new Map([
        ["first-win", 2],
        ["streak", 1],
      ]),
    );
  });

  it("is what the service gives a public page", async () => {
    const gameId = freshGame();
    await database.insert(gameMilestoneClaims).values(
      claim(await seedUser(), gameId, "complete", {
        milestoneId: "first-win",
      }),
    );
    expect(await service.mintCounts(gameId)).toEqual(
      new Map([["first-win", 1]]),
    );
  });

  it("is empty for a game nobody has minted in", async () => {
    expect((await repository.completeCounts(freshGame())).size).toBe(0);
  });
});
