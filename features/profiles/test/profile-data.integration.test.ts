import {
  createDrizzleProfileRepository,
  createProfilesService,
} from "@frostbite/profiles";
import { describe, expect, it } from "vitest";

import { createProfileData } from "../src/profile-data.ts";
import { loadPublicProfile } from "../src/public-profile.ts";
import {
  claimOf,
  database,
  registerDatabase,
  seedUser,
  settledRun,
} from "./support/database.ts";

registerDatabase();

const listed = new Set(["frost-runner", "tower-stack"]);
const data = createProfileData(database, listed);

describe("what a profile page reads of a player's records", () => {
  it("is the best verified score in each listed game, newest first as dates, and the completed mints", async () => {
    const userId = await seedUser();
    await settledRun(userId, "frost-runner", { day: 1, score: 100 });
    await settledRun(userId, "frost-runner", { day: 2, score: 900 });
    await settledRun(userId, "tower-stack", { day: 3, score: 12 });
    const done = await claimOf(userId, "frost-runner", "first-run", "complete");
    const { bests, mints } = await data.load(userId);
    expect(bests).toEqual([
      {
        achievedAt: "2026-11-02T12:00:00.000Z",
        gameId: "frost-runner",
        score: 900,
      },
      {
        achievedAt: "2026-11-03T12:00:00.000Z",
        gameId: "tower-stack",
        score: 12,
      },
    ]);
    expect(mints).toEqual([
      {
        claimId: done,
        gameId: "frost-runner",
        milestoneId: "first-run",
        mintedAt: "2026-11-08T12:00:00.000Z",
      },
    ]);
  });

  it("leaves out a game the platform does not list, a score no replay reached, and a claim that is not complete", async () => {
    const userId = await seedUser();
    await settledRun(userId, "retired-game", { day: 1, score: 500 });
    await settledRun(userId, "frost-runner", { day: 1, score: null });
    await settledRun(userId, "tower-stack", {
      day: 1,
      score: null,
      verdict: "rejected",
    });
    await claimOf(userId, "frost-runner", "first-run", "signed");
    await claimOf(userId, "retired-game", "gone", "complete");
    expect(await data.load(userId)).toEqual({ bests: [], mints: [] });
  });

  it("is another player's records only for that player", async () => {
    const [one, two] = [await seedUser(), await seedUser()];
    await settledRun(one, "frost-runner", { day: 1, score: 7 });
    expect((await data.load(two)).bests).toEqual([]);
  });
});

describe("the public profile of a name", () => {
  const service = createProfilesService({
    clock: () => new Date("2026-11-08T12:00:00.000Z"),
    policy: {
      blockedTerms: [],
      changeCooldownDays: 30,
      maxLength: 20,
      minLength: 3,
    },
    repository: createDrizzleProfileRepository(database),
  });
  const runtime = { data, service };
  const unique = () => `Player${Math.random().toString(36).slice(2, 8)}`;

  it("joins a visible profile to the player's records and carries no account id", async () => {
    const userId = await seedUser();
    const name = unique();
    await service.save(userId, { avatar: "yeti", name, visible: true });
    await settledRun(userId, "frost-runner", { day: 4, score: 42 });
    const view = await loadPublicProfile(runtime, name.toLowerCase());
    expect(view).toMatchObject({
      avatar: "yeti",
      name,
      bests: [{ gameId: "frost-runner", score: 42 }],
      mints: [],
    });
    expect(JSON.stringify(view)).not.toContain(userId);
  });

  it("is nothing for a profile switched off, even though its name is held", async () => {
    const userId = await seedUser();
    const name = unique();
    await service.save(userId, { avatar: "yeti", name, visible: false });
    await settledRun(userId, "frost-runner", { day: 4, score: 42 });
    expect(await loadPublicProfile(runtime, name)).toBeNull();
    expect(await service.checkName(await seedUser(), name)).toEqual({
      status: "taken",
    });
  });

  it("is nothing once the player takes it down", async () => {
    const userId = await seedUser();
    const name = unique();
    await service.save(userId, { avatar: "yeti", name, visible: true });
    await service.remove(userId);
    expect(await loadPublicProfile(runtime, name)).toBeNull();
  });
});
