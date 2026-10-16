import {
  gameAdminCapability,
  gameAdminDetailPath,
  gameAdminNavigationLabel,
  gameAdminPath,
} from "@ador/shared/games";
import { isValidElement } from "react";
import { describe, expect, it } from "vitest";

import { createGameAdminFeature } from "../src/registration.ts";
import { config, game, plainGame } from "./support/fixtures.ts";

const feature = () => createGameAdminFeature([game, plainGame], config());
const load = () =>
  feature().load({
    registeredFeatureCount: 1,
    registeredFeatureIds: ["game-admin"],
  });
const access = { capability: gameAdminCapability, kind: "platform" };

describe("game administration registration", () => {
  it("declares detachable routes and admin pages for staff, depending on the features whose data it uses", () => {
    expect(feature().manifest).toMatchObject({
      capabilities: [
        "api-routes",
        "authenticated-page",
        "navigation",
        "studio-page",
      ],
      dependencies: ["accounts", "games"],
      id: "game-admin",
      navigation: [
        {
          access,
          area: "admin",
          href: gameAdminPath,
          label: gameAdminNavigationLabel,
        },
      ],
      pages: [
        { access, path: gameAdminPath },
        { access, path: gameAdminDetailPath },
      ],
      requiredDecisionGates: [],
      requiredProviderCapabilities: [],
    });
    expect(
      feature().manifest.routes.map(
        ({ method, operationId }) => `${method} ${operationId}`,
      ),
    ).toEqual([
      "POST listGameAdminSteps",
      "POST refreshGameAdminStep",
      "POST startGameAdminStep",
      "POST submitGameAdminStep",
    ]);
  });

  it("loads an entrypoint whose operations and pages match the manifest, all requiring the administration capability", async () => {
    const entrypoint = await load();
    expect(entrypoint.operations?.map(({ route }) => route)).toEqual(
      feature().manifest.routes,
    );
    expect(entrypoint.pages?.map(({ path }) => path)).toEqual(
      feature().manifest.pages.map(({ path }) => path),
    );
    for (const item of [
      ...(entrypoint.operations ?? []),
      ...(entrypoint.pages ?? []),
    ])
      expect(item.access).toEqual(access);
    expect(entrypoint.id).toBe("game-admin");
  });

  it("renders the list page and the page of the game named in the path, known or not", async () => {
    const [list, detail] = (await load()).pages ?? [];
    const base = { actorUserId: null, navigation: [] } as const;
    expect(isValidElement(list?.render({ ...base, params: {} }))).toBe(true);
    expect(
      isValidElement(detail?.render({ ...base, params: { gameId: "arcade" } })),
    ).toBe(true);
    expect(
      isValidElement(detail?.render({ ...base, params: { gameId: "plain" } })),
    ).toBe(true);
  });
});
