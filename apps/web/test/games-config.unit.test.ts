import { gameManifestSchema } from "@ador/shared/games";
import { describe, expect, it } from "vitest";

import { targetChains } from "../../../configs/chains.ts";
import { games } from "../../../configs/games.ts";

describe("the platform's game list", () => {
  it("lists FROST·BITE, first, and every game passes the manifest schema", () => {
    expect(games.map(({ id }) => id)).toEqual(["frostbite"]);
    for (const game of games)
      expect(gameManifestSchema.safeParse(game).success).toBe(true);
  });

  it("registers FROST·BITE as not playable and declares nothing the platform cannot honour yet", () => {
    const [frostbite] = games;
    expect(frostbite?.launch).toEqual({ mode: "external", url: null });
    expect(frostbite?.capabilities).toEqual([]);
    expect(frostbite?.milestones).toEqual([]);
  });

  it("puts every game on a chain the platform is configured for", () => {
    const configured = targetChains.map(({ chainId }) => chainId);
    for (const game of games) expect(configured).toContain(game.network);
  });
});
