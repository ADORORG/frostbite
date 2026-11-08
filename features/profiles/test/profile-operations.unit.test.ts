import { unauthenticated } from "@frostbite/http/outcome";
import {
  checkProfileNameResponseSchema,
  getMyProfileResponseSchema,
  publicProfileSchema,
  saveProfileResponseSchema,
} from "@frostbite/shared/profiles";
import { createProfilesService, type ProfilePolicy } from "@frostbite/profiles";
import { memoryRepository } from "@frostbite/profiles/memory";
import { describe, expect, it, vi } from "vitest";

import {
  createCheckProfileNameOperation,
  createDeleteProfileOperation,
  createGetMyProfileOperation,
  createSaveProfileOperation,
} from "../src/application/profile-operations.ts";
import { createGetPublicProfileOperation } from "../src/application/public-operation.ts";
import type { ProfilesRuntime } from "../src/runtime.ts";
import { anonymous, context, other } from "./support/context.ts";

const policy: ProfilePolicy = {
  blockedTerms: ["admin"],
  changeCooldownDays: 30,
  maxLength: 20,
  minLength: 3,
};
const start = new Date("2026-11-08T12:00:00.000Z");
function setup() {
  const clock = { now: start };
  const service = createProfilesService({
    clock: () => clock.now,
    policy,
    repository: memoryRepository(),
  });
  return { clock, getService: async () => service, service };
}
const save = { avatar: "fox", name: "IceAda", visible: true } as const;

describe("the owner's profile operations", () => {
  it("are authenticated and on their contract routes", () => {
    const { getService } = setup();
    for (const operation of [
      createGetMyProfileOperation(getService),
      createCheckProfileNameOperation(getService),
      createSaveProfileOperation(getService),
      createDeleteProfileOperation(getService),
    ])
      expect(operation.access).toEqual({ kind: "authenticated" });
  });

  it("refuse a visitor with no session and touch nothing", async () => {
    const { getService, service } = setup();
    const spy = vi.spyOn(service, "save");
    const ctx = anonymous;
    expect(await createGetMyProfileOperation(getService).execute({}, ctx)).toBe(
      unauthenticated,
    );
    expect(
      await createCheckProfileNameOperation(getService).execute(
        { name: "Ada" },
        ctx,
      ),
    ).toBe(unauthenticated);
    expect(
      await createSaveProfileOperation(getService).execute(save, ctx),
    ).toBe(unauthenticated);
    expect(
      await createDeleteProfileOperation(getService).execute({}, ctx),
    ).toBe(unauthenticated);
    expect(spy).not.toHaveBeenCalled();
  });

  it("answer a player with no profile with the rules and none, in the contract's shape", async () => {
    const { getService } = setup();
    const answer = await createGetMyProfileOperation(getService).execute(
      {},
      context,
    );
    expect(answer).toEqual({
      ok: true,
      value: {
        policy: { changeCooldownDays: 30, maxLength: 20, minLength: 3 },
        profile: null,
      },
    });
    expect(
      getMyProfileResponseSchema.safeParse(answer.ok ? answer.value : null)
        .success,
    ).toBe(true);
  });

  it("save for the session's player, and answer with the profile and when its name may change", async () => {
    const { getService } = setup();
    const ctx = context;
    const saved = await createSaveProfileOperation(getService).execute(
      save,
      ctx,
    );
    expect(saved).toMatchObject({
      ok: true,
      value: {
        profile: {
          avatar: "fox",
          canChangeNameAt: "2026-12-08T12:00:00.000Z",
          memberSince: start.toISOString(),
          name: "IceAda",
          visible: true,
        },
        status: "saved",
      },
    });
    expect(
      saveProfileResponseSchema.safeParse(saved.ok ? saved.value : null)
        .success,
    ).toBe(true);
    const mine = await createGetMyProfileOperation(getService).execute({}, ctx);
    expect(mine).toMatchObject({ value: { profile: { name: "IceAda" } } });
  });

  it("say why a save was refused, in the words of the service", async () => {
    const { getService } = setup();
    const op = createSaveProfileOperation(getService);
    expect(await op.execute({ ...save, name: "the_admin" }, context)).toEqual({
      ok: true,
      value: {
        reason: "blocked",
        refusal: "name-invalid",
        status: "refused",
        until: null,
      },
    });
    await op.execute(save, context);
    expect(await op.execute(save, other)).toMatchObject({
      value: { refusal: "name-taken" },
    });
    expect(await op.execute({ ...save, name: "Grace" }, context)).toMatchObject(
      {
        value: { refusal: "name-locked", until: "2026-12-08T12:00:00.000Z" },
      },
    );
  });

  it("tell a player whether a name is free, with a lock as a time", async () => {
    const { getService } = setup();
    const check = createCheckProfileNameOperation(getService);
    const ctx = context;
    expect(await check.execute({ name: "Ada" }, ctx)).toEqual({
      ok: true,
      value: { status: "available" },
    });
    await createSaveProfileOperation(getService).execute(save, ctx);
    expect(await check.execute({ name: "iceada" }, ctx)).toEqual({
      ok: true,
      value: { status: "yours" },
    });
    const locked = await check.execute({ name: "Grace" }, ctx);
    expect(locked).toEqual({
      ok: true,
      value: { status: "locked", until: "2026-12-08T12:00:00.000Z" },
    });
    expect(
      checkProfileNameResponseSchema.safeParse(locked.ok ? locked.value : null)
        .success,
    ).toBe(true);
    expect(await check.execute({ name: "a b" }, ctx)).toEqual({
      ok: true,
      value: { reason: "bad-characters", status: "invalid" },
    });
  });

  it("take the session's profile down, and say whether there was one", async () => {
    const { getService } = setup();
    const ctx = context;
    await createSaveProfileOperation(getService).execute(save, ctx);
    const remove = createDeleteProfileOperation(getService);
    expect(await remove.execute({}, ctx)).toEqual({
      ok: true,
      value: { deleted: true },
    });
    expect(await remove.execute({}, ctx)).toEqual({
      ok: true,
      value: { deleted: false },
    });
  });
});

describe("the public profile operation", () => {
  const record = {
    bests: [
      {
        achievedAt: "2026-11-06T10:00:00.000Z",
        gameId: "frost-runner",
        score: 18_420,
      },
    ],
    mints: [],
  };
  async function publicOperation() {
    const { service } = setup();
    await service.save("u1", { avatar: "owl", name: "IceAda", visible: true });
    await service.save("u2", { avatar: "fox", name: "Shy", visible: false });
    const load = vi.fn(async () => record);
    const runtime: ProfilesRuntime = { data: { load }, service };
    return {
      load,
      operation: createGetPublicProfileOperation(async () => runtime),
    };
  }

  it("is public and kept for a minute", async () => {
    const { operation } = await publicOperation();
    expect(operation.access).toEqual({ kind: "public" });
    expect(operation.cache).toEqual({ kind: "max-age", seconds: 60 });
  });

  it("shows a profile that is switched on, in the contract's shape, with no account id", async () => {
    const { load, operation } = await publicOperation();
    const answer = await operation.execute({ name: "iceada" });
    expect(answer).toMatchObject({
      ok: true,
      value: { avatar: "owl", bests: record.bests, mints: [], name: "IceAda" },
    });
    expect(
      publicProfileSchema.safeParse(answer.ok ? answer.value : null).success,
    ).toBe(true);
    expect(JSON.stringify(answer)).not.toContain("u1");
    expect(load).toHaveBeenCalledExactlyOnceWith("u1");
  });

  it("answers a hidden profile, an unknown name and a name that cannot be one all alike, reading no records", async () => {
    const { load, operation } = await publicOperation();
    const hidden = await operation.execute({ name: "Shy" });
    const unknown = await operation.execute({ name: "Nobody" });
    const malformed = await operation.execute({ name: "a b" });
    expect(hidden.ok).toBe(false);
    expect(hidden).toEqual(unknown);
    expect(hidden).toEqual(malformed);
    expect(load).not.toHaveBeenCalled();
  });
});
