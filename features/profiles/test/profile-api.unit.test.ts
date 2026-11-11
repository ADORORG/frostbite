import type { FetchLike } from "@frostbite/client-http";
import {
  checkProfileNameRoute,
  deleteProfileRoute,
  getMyProfileRoute,
  saveProfileRoute,
} from "@frostbite/shared/profiles";
import { describe, expect, it, vi } from "vitest";

import { createProfileApi } from "../src/client/profile-api.ts";
import { policy, saved } from "./support/profile-api.ts";

const json = (body: object) =>
  new Response(JSON.stringify(body), {
    headers: { "content-type": "application/json" },
  });
const call = (fetchImpl: ReturnType<typeof vi.fn>, index = 0) => {
  const [path, init] = fetchImpl.mock.calls[index] ?? [];
  return { init: init as RequestInit, path: String(path) };
};

describe("the profile routes as the page reaches them", () => {
  it("reads the player's own profile and the rules, validating what comes back", async () => {
    const fetchImpl = vi.fn<FetchLike>(async () =>
      json({ policy, profile: saved }),
    );
    expect(await createProfileApi(fetchImpl).getMine()).toEqual({
      policy,
      profile: saved,
    });
    expect(call(fetchImpl)).toMatchObject({
      init: { method: "GET" },
      path: getMyProfileRoute.path,
    });
  });

  it("asks whether a name is free through the query string, so the name cannot add or end a parameter", async () => {
    const fetchImpl = vi.fn<FetchLike>(async () =>
      json({ status: "available" }),
    );
    const controller = new AbortController();
    await createProfileApi(fetchImpl).checkName("a&b=c", controller.signal);
    expect(call(fetchImpl).path).toBe(
      `${checkProfileNameRoute.path}?name=a%26b%3Dc`,
    );
    expect(call(fetchImpl).init.signal).toBe(controller.signal);
  });

  it("gives a name check a time limit of its own when the caller sets none", async () => {
    const fetchImpl = vi.fn<FetchLike>(async () => json({ status: "taken" }));
    await createProfileApi(fetchImpl).checkName("Ada");
    expect(call(fetchImpl).init.signal).toBeInstanceOf(AbortSignal);
  });

  it("saves with the player's choices as the body, and reads the answer", async () => {
    const fetchImpl = vi.fn<FetchLike>(async () =>
      json({ profile: saved, status: "saved" }),
    );
    const input = { avatar: "fox", name: "IceAda", visible: true } as const;
    expect(await createProfileApi(fetchImpl).save(input)).toEqual({
      profile: saved,
      status: "saved",
    });
    expect(call(fetchImpl)).toMatchObject({
      init: { method: "POST" },
      path: saveProfileRoute.path,
    });
    expect(JSON.parse(String(call(fetchImpl).init.body))).toEqual(input);
  });

  it("takes the profile down with an empty body", async () => {
    const fetchImpl = vi.fn<FetchLike>(async () => json({ deleted: true }));
    expect(await createProfileApi(fetchImpl).remove()).toEqual({
      deleted: true,
    });
    expect(call(fetchImpl).path).toBe(deleteProfileRoute.path);
    expect(JSON.parse(String(call(fetchImpl).init.body))).toEqual({});
  });

  it("refuses an answer that is not in the contract's shape", async () => {
    const fetchImpl = vi.fn<FetchLike>(async () => json({ status: "maybe" }));
    await expect(
      createProfileApi(fetchImpl).checkName("Ada"),
    ).rejects.toThrow();
  });
});
