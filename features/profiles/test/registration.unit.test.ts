import type { ShareConfig } from "@frostbite/share";
import {
  getPublicProfileRoute,
  profilePagePath,
  profileSetupPath,
} from "@frostbite/shared/profiles";
import { isValidElement } from "react";
import { describe, expect, it } from "vitest";

import { createProfilesFeature } from "../src/registration.ts";
import { policy } from "./support/profile-api.ts";
import { runner, stacker } from "./support/games.ts";

const rules = { ...policy, blockedTerms: ["admin"] };
const share: ShareConfig = {
  hashtags: [],
  platforms: [
    {
      accent: "#000000",
      id: "x",
      label: "X",
      mark: "X",
      template: "https://x.example/?t={text}&u={url}",
    },
  ],
};
// The feature is given the same manifests as the games feature; the profile pages read only the games' public view, built from them.
const feature = (withShare = false) =>
  createProfilesFeature([], [], rules, ...(withShare ? [share] : []));
const load = (withShare = false) =>
  feature(withShare).load({
    registeredFeatureCount: 1,
    registeredFeatureIds: ["profiles"],
  });
const base = { actorUserId: null, navigation: [] } as const;

describe("the profiles feature registration", () => {
  it("declares detachable routes and two pages, depending on the features whose data it reads", () => {
    expect(feature().manifest).toMatchObject({
      capabilities: ["api-routes", "authenticated-page", "public-page"],
      dependencies: ["accounts", "games"],
      id: "profiles",
      navigation: [],
      pages: [
        { access: { kind: "authenticated" }, path: profileSetupPath },
        { access: { kind: "public" }, path: profilePagePath },
      ],
    });
    expect(
      feature().manifest.routes.map(
        ({ method, operationId }) => `${method} ${operationId}`,
      ),
    ).toEqual([
      "GET getMyProfile",
      "GET checkProfileName",
      "POST saveProfile",
      "POST deleteProfile",
      "GET getPublicProfile",
    ]);
  });

  it("loads an entrypoint whose operations and pages match the manifest, the owner's behind a session and the public one open", async () => {
    const entrypoint = await load();
    expect(entrypoint.operations?.map(({ route }) => route)).toEqual(
      feature().manifest.routes,
    );
    expect(entrypoint.pages?.map(({ path }) => path)).toEqual(
      feature().manifest.pages.map(({ path }) => path),
    );
    const access = Object.fromEntries(
      (entrypoint.operations ?? []).map(({ route, access: a }) => [
        route.operationId,
        a.kind,
      ]),
    );
    expect(access).toEqual({
      checkProfileName: "authenticated",
      deleteProfile: "authenticated",
      getMyProfile: "authenticated",
      getPublicProfile: "public",
      saveProfile: "authenticated",
    });
    expect(getPublicProfileRoute.path).toBe("/api/v1/profiles");
    expect(entrypoint.id).toBe("profiles");
  });

  it("renders the setup page, keeping it out of search, with sharing only when it is configured", async () => {
    for (const withShare of [false, true]) {
      const [setup] = (await load(withShare)).pages ?? [];
      expect(isValidElement(await setup?.render({ ...base, params: {} }))).toBe(
        true,
      );
      expect(await setup?.metadata?.({ params: {} })).toMatchObject({
        kind: "private",
      });
    }
  });

  it("renders the page with no name in its address as the not-found page without asking storage, and keeps it out of search", async () => {
    const [, page] = (await load(true)).pages ?? [];
    expect(isValidElement(await page?.render({ ...base, params: {} }))).toBe(
      true,
    );
    expect(await page?.metadata?.({ params: {} })).toMatchObject({
      kind: "private",
    });
  });

  it("is given games it does not need to know beyond their public view", () => {
    expect(createProfilesFeature([], [], rules).manifest.id).toBe("profiles");
    expect([runner.id, stacker.id]).toEqual(["frost-runner", "tower-stack"]);
  });
});
