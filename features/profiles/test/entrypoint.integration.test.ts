import { ScenesProvider } from "@frostbite/scenes/react";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { createProfilesFeature } from "../src/registration.ts";
import { policy } from "./support/profile-api.ts";
import {
  claimOf,
  database,
  registerDatabase,
  seedUser,
  settledRun,
} from "./support/database.ts";
import {
  createDrizzleProfileRepository,
  createProfilesService,
} from "@frostbite/profiles";
import { chains, games } from "./support/manifests.ts";

registerDatabase();

// The public page as the platform renders it: the feature's own entrypoint, over real PostgreSQL, with the games it is given.
const rules = { ...policy, blockedTerms: ["admin"] };
const load = () =>
  createProfilesFeature(games, chains, rules).load({
    registeredFeatureCount: 1,
    registeredFeatureIds: ["profiles"],
  });
const service = createProfilesService({
  clock: () => new Date("2026-11-08T12:00:00.000Z"),
  policy: rules,
  repository: createDrizzleProfileRepository(database),
});
const unique = () => `Page${Math.random().toString(36).slice(2, 8)}`;
const base = { actorUserId: null, navigation: [] } as const;

describe("a public profile page as rendered", () => {
  it("shows a switched-on profile with its verified score and its mint, and titles the link preview with the name", async () => {
    const [entrypoint, userId, name] = [
      await load(),
      await seedUser(),
      unique(),
    ];
    const [, page] = entrypoint.pages ?? [];
    await service.save(userId, { avatar: "owl", name, visible: true });
    await settledRun(userId, games[0]?.id ?? "", { day: 2, score: 777 });
    await claimOf(
      userId,
      games[0]?.id ?? "",
      games[0]?.milestones[0]?.id ?? "",
      "complete",
    );
    const element = await page?.render({ ...base, params: { name } });
    const html = renderToStaticMarkup(
      createElement(ScenesProvider, null, element),
    );
    expect(html).toContain(name);
    expect(html).toContain("777");
    expect(html).toContain("Verified");
    expect(html).toContain("Minted milestones");
    expect(await page?.metadata?.({ params: { name } })).toMatchObject({
      kind: "shared",
      title: `${name}'s player card`,
    });
  });

  it("shows the not-found page, and keeps it out of search, for a hidden profile, an unknown name and a name that cannot be one", async () => {
    const [entrypoint, userId, hidden] = [
      await load(),
      await seedUser(),
      unique(),
    ];
    const [, page] = entrypoint.pages ?? [];
    await service.save(userId, { avatar: "owl", name: hidden, visible: false });
    for (const name of [hidden, "NobodyHere", "a b"]) {
      const html = renderToStaticMarkup(
        createElement(
          ScenesProvider,
          null,
          await page?.render({ ...base, params: { name } }),
        ),
      );
      expect(html).toContain("No player here");
      expect(html).not.toContain(hidden);
      expect(await page?.metadata?.({ params: { name } })).toMatchObject({
        kind: "private",
      });
    }
  });
});
