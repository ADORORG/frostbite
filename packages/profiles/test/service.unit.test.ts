import { describe, expect, it } from "vitest";

import { createProfilesService } from "../src/service.ts";
import { memoryRepository } from "../src/memory-repository.ts";
import { policy } from "./policy.ts";

const start = new Date("2026-11-08T12:00:00.000Z");
const day = 86_400_000;

function setup() {
  const clock = { now: start };
  const repository = memoryRepository();
  const service = createProfilesService({
    clock: () => clock.now,
    policy,
    repository,
  });
  return { clock, repository, service };
}
const input = (name: string, over: { visible?: boolean } = {}) => ({
  avatar: "fox" as const,
  name,
  visible: over.visible ?? true,
});

describe("making a profile", () => {
  it("saves a first profile with the name, picture and visibility, and starts the name's clock", async () => {
    const { service } = setup();
    const result = await service.save("u1", input("Ada"));
    expect(result).toMatchObject({
      profile: {
        avatar: "fox",
        createdAt: start,
        name: "Ada",
        nameChangedAt: start,
        nameKey: "ada",
        userId: "u1",
        visible: true,
      },
      status: "saved",
    });
    expect(await service.get("u1")).toMatchObject({ name: "Ada" });
  });

  it("refuses a name that breaks the rules, saving nothing", async () => {
    const { repository, service } = setup();
    expect(await service.save("u1", input("a b"))).toEqual({
      reason: "bad-characters",
      refusal: "name-invalid",
      status: "refused",
      until: null,
    });
    expect(await service.save("u1", input("the_admin"))).toMatchObject({
      reason: "blocked",
    });
    expect(repository.rows.size).toBe(0);
  });

  it("refuses a name another player holds, in any case, shown or hidden", async () => {
    const { service } = setup();
    await service.save("u1", input("Ada", { visible: false }));
    expect(await service.save("u2", input("ADA"))).toEqual({
      reason: null,
      refusal: "name-taken",
      status: "refused",
      until: null,
    });
  });
});

describe("changing a profile", () => {
  it("changes the picture and visibility at any time without touching the name's clock", async () => {
    const { clock, service } = setup();
    await service.save("u1", input("Ada"));
    clock.now = new Date(start.getTime() + day);
    const result = await service.save("u1", {
      avatar: "owl",
      name: "Ada",
      visible: false,
    });
    expect(result).toMatchObject({
      profile: {
        avatar: "owl",
        createdAt: start,
        nameChangedAt: start,
        visible: false,
      },
      status: "saved",
    });
  });

  it("lets a player change only the capitals of their own name, with no wait", async () => {
    const { clock, service } = setup();
    await service.save("u1", input("ada"));
    clock.now = new Date(start.getTime() + day);
    expect(await service.save("u1", input("Ada"))).toMatchObject({
      profile: { name: "Ada", nameChangedAt: start },
      status: "saved",
    });
  });

  it("holds back a new name until the cooldown has passed, and says when", async () => {
    const { clock, service } = setup();
    await service.save("u1", input("Ada"));
    clock.now = new Date(start.getTime() + 29 * day);
    expect(await service.save("u1", input("Grace"))).toEqual({
      reason: null,
      refusal: "name-locked",
      status: "refused",
      until: new Date(start.getTime() + 30 * day),
    });
    expect(await service.get("u1")).toMatchObject({ name: "Ada" });
    clock.now = new Date(start.getTime() + 30 * day);
    expect(await service.save("u1", input("Grace"))).toMatchObject({
      profile: { name: "Grace", nameChangedAt: clock.now },
      status: "saved",
    });
  });

  it("frees the old name when the player takes a new one", async () => {
    const { clock, service } = setup();
    await service.save("u1", input("Ada"));
    clock.now = new Date(start.getTime() + 31 * day);
    await service.save("u1", input("Grace"));
    expect(await service.save("u2", input("Ada"))).toMatchObject({
      status: "saved",
    });
  });

  it("checks the cooldown before it checks whether the name is free", async () => {
    const { service } = setup();
    await service.save("u1", input("Ada"));
    await service.save("u2", input("Grace"));
    expect(await service.save("u1", input("Grace"))).toMatchObject({
      refusal: "name-locked",
    });
  });
});

describe("telling a player whether a name is free", () => {
  it("answers invalid, yours, locked, taken and available", async () => {
    const { clock, service } = setup();
    await service.save("u1", input("Ada"));
    await service.save("u2", input("Grace"));
    expect(await service.checkName("u3", "x")).toEqual({
      reason: "too-short",
      status: "invalid",
    });
    expect(await service.checkName("u1", "ADA")).toEqual({ status: "yours" });
    expect(await service.checkName("u1", "Linus")).toEqual({
      status: "locked",
      until: new Date(start.getTime() + 30 * day),
    });
    expect(await service.checkName("u3", "grace")).toEqual({ status: "taken" });
    expect(await service.checkName("u3", "Linus")).toEqual({
      status: "available",
    });
    clock.now = new Date(start.getTime() + 31 * day);
    expect(await service.checkName("u1", "grace")).toEqual({ status: "taken" });
    expect(await service.checkName("u1", "Linus")).toEqual({
      status: "available",
    });
  });
});

describe("the public view", () => {
  it("shows a profile that is switched on, by name in any case, and nothing else", async () => {
    const { service } = setup();
    await service.save("u1", input("Ada"));
    await service.save("u2", input("Grace", { visible: false }));
    expect(await service.getPublic("aDa")).toMatchObject({ name: "Ada" });
    expect(await service.getPublic("Grace")).toBeNull();
    expect(await service.getPublic("nobody")).toBeNull();
    expect(await service.getPublic("a b")).toBeNull();
  });
});

describe("removing a profile", () => {
  it("removes it, says whether there was one, and frees the name", async () => {
    const { service } = setup();
    await service.save("u1", input("Ada"));
    expect(await service.remove("u1")).toBe(true);
    expect(await service.remove("u1")).toBe(false);
    expect(await service.getPublic("Ada")).toBeNull();
    expect(await service.save("u2", input("Ada"))).toMatchObject({
      status: "saved",
    });
  });

  it("starts the cooldown afresh for a player who makes a new profile", async () => {
    const { service } = setup();
    await service.save("u1", input("Ada"));
    await service.remove("u1");
    expect(await service.save("u1", input("Grace"))).toMatchObject({
      status: "saved",
    });
  });
});

describe("when a name may change again", () => {
  it("is null once the cooldown has passed, and never held for a cooldown of zero", async () => {
    const { clock, repository, service } = setup();
    await service.save("u1", input("Ada"));
    const profile = repository.rows.get("u1");
    if (profile === undefined) throw new Error("expected a profile");
    expect(service.unlocksAt(profile)).toEqual(
      new Date(start.getTime() + 30 * day),
    );
    clock.now = new Date(start.getTime() + 30 * day);
    expect(service.unlocksAt(profile)).toBeNull();
    const free = createProfilesService({
      clock: () => start,
      policy: { ...policy, changeCooldownDays: 0 },
      repository,
    });
    expect(free.unlocksAt(profile)).toBeNull();
  });
});
