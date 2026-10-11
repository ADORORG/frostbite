import { gameManifestSchema, gamePlayAddress } from "@ador/shared/games";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { targetChains } from "../../../configs/chains.ts";

const signet = targetChains[0]?.chainId ?? "";

// The game list reads the deployment's settings when it is first imported, so each case sets them and
// imports it afresh.
async function gamesWith(launches: string, appEnv = "local") {
  vi.resetModules();
  vi.stubEnv("APP_ENV", appEnv);
  vi.stubEnv("PUBLIC_BASE_URL", "https://platform.example.com");
  vi.stubEnv("NEXT_PUBLIC_APP_NAME", "Adorbitals");
  vi.stubEnv("GAME_LAUNCHES", launches);
  return (await import("../../../configs/games.ts")).games;
}

beforeEach(() => {
  vi.unstubAllEnvs();
});
afterEach(() => {
  vi.unstubAllEnvs();
});

describe("the platform's game list", () => {
  it("lists FROST·BITE, first, then the sample game while the platform runs for development, and every game passes the manifest schema", async () => {
    const games = await gamesWith("");
    expect(games.map(({ id }) => id)).toEqual(["frostbite", "sample-game"]);
    for (const game of games)
      expect(gameManifestSchema.safeParse(game).success).toBe(true);
  });

  it("registers FROST·BITE as not playable until a deployment says where it is played, and declares nothing the platform cannot honour yet", async () => {
    const [frostbite] = await gamesWith("");
    expect(frostbite?.launch).toEqual({
      basePath: "",
      mode: "external",
      returnUrl: null,
      url: null,
    });
    expect(frostbite?.capabilities).toEqual([]);
    expect(frostbite?.milestones).toEqual([]);
    expect(frostbite?.network).toBe(signet);
  });

  it("is played at its own host when the deployment gives one (subdomain style)", async () => {
    const [frostbite] = await gamesWith(
      JSON.stringify({ frostbite: { url: "https://frostbite.example.com" } }),
    );
    expect(frostbite && gamePlayAddress(frostbite.launch)).toBe(
      "https://frostbite.example.com/",
    );
  });

  it("is played under a path of a host when the deployment gives a base path (domain-path style), and returns players to the platform", async () => {
    const [frostbite] = await gamesWith(
      JSON.stringify({
        frostbite: {
          basePath: "/play/frostbite",
          returnUrl: "https://platform.example.com/games/frostbite",
          url: "https://example.com",
        },
      }),
    );
    expect(frostbite && gamePlayAddress(frostbite.launch)).toBe(
      "https://example.com/play/frostbite",
    );
    expect(
      frostbite?.launch.mode === "external" && frostbite.launch.returnUrl,
    ).toBe("https://platform.example.com/games/frostbite");
  });

  it.each([
    ["test", true],
    ["local", true],
    ["preview", false],
    ["production", false],
  ])("lists the sample game in %s: %s", async (appEnv, listed) => {
    const ids = (await gamesWith("", appEnv)).map(({ id }) => id);
    expect(ids.includes("sample-game")).toBe(listed);
    expect(ids[0]).toBe("frostbite");
  });

  it("plays the sample game on the platform itself, in the frame, with the milestones its code awards", async () => {
    const sample = (await gamesWith("")).find(({ id }) => id === "sample-game");
    expect(sample?.launch).toEqual({ mode: "embedded" });
    expect(sample?.milestones.map(({ id }) => id)).toEqual([
      "first-five",
      "ten-taps",
    ]);
  });

  it("refuses a launch setting for a game the platform plays itself", async () => {
    await expect(
      gamesWith(
        JSON.stringify({ "sample-game": { url: "https://a.example.com" } }),
      ),
    ).rejects.toThrow("Launch settings name");
  });

  it("refuses to start with a setting for a game that is not registered", async () => {
    await expect(
      gamesWith(
        JSON.stringify({ frostbyte: { url: "https://a.example.com" } }),
      ),
    ).rejects.toThrow('"frostbyte"');
  });

  it("refuses to start with a game on a chain that is not configured", async () => {
    await expect(
      gamesWith(
        JSON.stringify({
          frostbite: { network: "eip155:1", url: "https://a.example.com" },
        }),
      ),
    ).rejects.toThrow("not a configured chain");
  });

  it("accepts a configured chain as the game's network", async () => {
    const [frostbite] = await gamesWith(
      JSON.stringify({
        frostbite: { network: signet, url: "https://a.example.com" },
      }),
    );
    expect(frostbite?.network).toBe(signet);
  });
});
