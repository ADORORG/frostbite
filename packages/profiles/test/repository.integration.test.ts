import { randomUUID } from "node:crypto";

import { authUsers, playerProfiles } from "@frostbite/database";
import { eq } from "drizzle-orm";
import { describe, expect, it } from "vitest";

import {
  database,
  profileOf,
  registerDatabase,
  repository,
  seedUser,
} from "./profile-database.ts";

registerDatabase();

// Each test uses names of its own: the database lasts for the whole file.
const unique = (stem: string) => `${stem}${randomUUID().slice(0, 8)}`;

describe("profiles in PostgreSQL", () => {
  it("saves a profile and reads it back, for its player and by name in any case", async () => {
    const userId = await seedUser();
    const name = unique("Ada");
    expect(await repository.save(profileOf(userId, name))).toEqual({
      kind: "saved",
    });
    expect(await repository.find(userId)).toMatchObject({
      avatar: "fox",
      name,
      userId,
      visible: true,
    });
    expect(await repository.findPublic(name.toLowerCase())).toMatchObject({
      userId,
    });
  });

  it("replaces the player's profile on a second save, keeping one row", async () => {
    const userId = await seedUser();
    const name = unique("Grace");
    await repository.save(profileOf(userId, name));
    const later = new Date("2026-12-01T00:00:00.000Z");
    await repository.save(
      profileOf(userId, name, {
        avatar: "owl",
        updatedAt: later,
        visible: false,
      }),
    );
    expect(await repository.find(userId)).toMatchObject({
      avatar: "owl",
      updatedAt: later,
      visible: false,
    });
    const rows = await database
      .select()
      .from(playerProfiles)
      .where(eq(playerProfiles.userId, userId));
    expect(rows).toHaveLength(1);
  });

  it("answers a public lookup only for a profile that is switched on, while a hidden one still owns its name", async () => {
    const userId = await seedUser();
    const name = unique("Hidden");
    await repository.save(profileOf(userId, name, { visible: false }));
    expect(await repository.findPublic(name.toLowerCase())).toBeNull();
    expect(await repository.holderOf(name.toLowerCase())).toBe(userId);
  });

  it("refuses a name another player holds, whatever its capitals", async () => {
    const [first, second] = [await seedUser(), await seedUser()];
    const name = unique("Linus");
    await repository.save(profileOf(first, name));
    expect(
      await repository.save(profileOf(second, name.toUpperCase())),
    ).toEqual({ kind: "name-taken" });
    expect(await repository.find(second)).toBeNull();
  });

  it("lets exactly one of two players who choose a name together have it", async () => {
    const [first, second] = [await seedUser(), await seedUser()];
    const name = unique("Race");
    const outcomes = await Promise.all([
      repository.save(profileOf(first, name)),
      repository.save(profileOf(second, name)),
    ]);
    expect(outcomes.map((outcome) => outcome.kind).sort()).toEqual([
      "name-taken",
      "saved",
    ]);
    const holder = await repository.holderOf(name.toLowerCase());
    expect([first, second]).toContain(holder);
  });

  it("frees the name when the profile is deleted, and says whether there was one", async () => {
    const [first, second] = [await seedUser(), await seedUser()];
    const name = unique("Free");
    await repository.save(profileOf(first, name));
    expect(await repository.delete(first)).toBe(true);
    expect(await repository.delete(first)).toBe(false);
    expect(await repository.save(profileOf(second, name))).toEqual({
      kind: "saved",
    });
  });

  it("goes with the account", async () => {
    const userId = await seedUser();
    const name = unique("Gone");
    await repository.save(profileOf(userId, name));
    await database.delete(authUsers).where(eq(authUsers.id, userId));
    expect(await repository.holderOf(name.toLowerCase())).toBeNull();
  });
});

describe("what the profiles table refuses by itself", () => {
  const insert = async (over: Record<string, unknown>) => {
    const userId = await seedUser();
    const name = unique("Table");
    return database.insert(playerProfiles).values({
      avatar: "fox",
      createdAt: new Date("2026-11-08T12:00:00.000Z"),
      name,
      nameChangedAt: new Date("2026-11-08T12:00:00.000Z"),
      nameKey: name.toLowerCase(),
      updatedAt: new Date("2026-11-08T12:00:00.000Z"),
      userId,
      visible: true,
      ...over,
    });
  };
  const refused = (promise: Promise<unknown>, constraint: string) =>
    expect(promise).rejects.toMatchObject({ cause: { constraint } });

  it("refuses a name key that is not the name in lower case", async () => {
    await refused(
      insert({ name: "Mixed", nameKey: "Mixed" }),
      "player_profiles_name_key_is_lower",
    );
  });

  it("refuses a name that is empty, too long or not plain", async () => {
    await refused(
      insert({ name: "", nameKey: "" }),
      "player_profiles_name_bounded",
    );
    const long = "x".repeat(33);
    await refused(
      insert({ name: long, nameKey: long }),
      "player_profiles_name_bounded",
    );
    await refused(
      insert({ name: "a b", nameKey: "a b" }),
      "player_profiles_name_plain",
    );
    await refused(
      insert({ name: "_a", nameKey: "_a" }),
      "player_profiles_name_plain",
    );
  });

  it("refuses a name changed before the profile was made", async () => {
    await refused(
      insert({ nameChangedAt: new Date("2026-01-01T00:00:00.000Z") }),
      "player_profiles_changed_after_created",
    );
  });

  it("keeps one profile per player", async () => {
    const userId = await seedUser();
    const name = unique("Once");
    await repository.save(profileOf(userId, name));
    const second = unique("Twice");
    await refused(
      insert({ name: second, nameKey: second.toLowerCase(), userId }),
      "player_profiles_pkey",
    );
  });
});
