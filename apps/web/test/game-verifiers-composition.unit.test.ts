import { createHash } from "node:crypto";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { bundleVerifier } from "@ador/game-sdk/build";
import { verifyRun } from "@ador/game-verification/verify";
import { defineGame } from "@ador/shared/games";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { createGameVerifiers } from "../src/server/games/verifiers.ts";

// A game the platform has never heard of, onboarded the way any game is: its rules built into verifier.js, the digest pinned in
// its manifest, the file served with the game. Nothing in the platform is edited for it.
const rulesSource = `
import type { GameVerifier } from "@ador/game-sdk/run-record";
const rules: GameVerifier<number> = {
  earned: (total) => (total >= 3 ? ["reached"] : []),
  id: "adder",
  init: () => ({ ok: true, state: 0 }),
  step: (total, input) =>
    input.type === "add" && typeof input.data === "number"
      ? { ok: true, state: total + input.data }
      : { ok: false, reason: "add takes a number" },
  version: 1,
};
export default rules;
export const sample = () => ({
  claims: ["reached"], config: {}, gameId: "adder-game", inputs: [{ data: 3, type: "add" }],
  schemaVersion: 1 as const, seed: 5, verifier: "adder", verifierVersion: 1,
});
`;
let scratch = "";
beforeEach(async () => {
  scratch = await mkdtemp(join(tmpdir(), "play-root-"));
});
afterEach(async () => rm(scratch, { force: true, recursive: true }));

async function publish(gameId: string, tamper = false) {
  const source = join(scratch, "source", gameId);
  await mkdir(join(source, "src"), { recursive: true });
  await writeFile(join(source, "src", "replay.ts"), rulesSource);
  const built = await bundleVerifier(source);
  if (built === null) throw new Error("No artifact");
  await mkdir(join(scratch, "play", gameId), { recursive: true });
  await writeFile(
    join(scratch, "play", gameId, "verifier.js"),
    tamper ? `${built.code}\n` : built.code,
  );
  return built;
}
const manifest = (id: string, sha256: string) =>
  defineGame({
    capabilities: ["run:submit"],
    description: "",
    id,
    launch: { mode: "embedded" },
    milestones: [
      {
        claimPolicy: "once",
        criteria: "Reach three.",
        description: "Reached three.",
        id: "reached",
        title: "Reached",
        verification: "replay-verified",
      },
    ],
    network: "bip122:00000008819873e925422c1ff0f99f7c",
    schemaVersion: 1,
    summary: "An adder.",
    title: "Adder",
    verification: { replay: { id: "adder", sha256, version: 1 } },
    version: "1",
  });
const playRoot = () => join(scratch, "play");

describe("the platform's verifiers, built from games' manifests and their built files", () => {
  it("picks up a game that publishes rules, with no change to the platform, and replays its runs", async () => {
    const built = await publish("adder-game");
    const { problems, registry } = await createGameVerifiers({
      games: [manifest("adder-game", built.sha256)],
      playRoot: playRoot(),
    });
    expect(problems).toEqual([]);
    expect(registry.gameIds()).toEqual(["adder-game"]);
    const sample = registry.find("adder-game")?.sample;
    expect(verifyRun(registry, sample)).toMatchObject({
      earned: ["reached"],
      status: "verified",
    });
    expect(
      verifyRun(registry, { ...sample, inputs: [{ data: 1, type: "add" }] }),
    ).toMatchObject({
      reason: "claim-not-earned",
    });
  });

  it("refuses another game's copy of the same artifact, whose sample run names the first game, so one game cannot pose as another", async () => {
    const built = await publish("adder-game");
    await publish("second-adder");
    const { problems, registry } = await createGameVerifiers({
      games: [
        manifest("adder-game", built.sha256),
        manifest("second-adder", built.sha256),
      ],
      playRoot: playRoot(),
    });
    expect(problems).toMatchObject([
      { gameId: "second-adder", reason: "bad-sample" },
    ]);
    expect(registry.gameIds()).toEqual(["adder-game"]);
  });

  it("refuses a served file that is not the one the manifest pins, and a game whose file is not served", async () => {
    const built = await publish("adder-game", true);
    const result = await createGameVerifiers({
      games: [
        manifest("adder-game", built.sha256),
        manifest("unserved-game", built.sha256),
      ],
      playRoot: playRoot(),
    });
    expect(
      result.problems.map(({ gameId, reason }) => `${gameId}: ${reason}`),
    ).toEqual([
      "adder-game: digest-mismatch",
      "unserved-game: missing-artifact",
    ]);
    expect(result.registry.gameIds()).toEqual([]);
    expect(result.problems[0]?.detail).toContain(
      createHash("sha256").update(`${built.code}\n`).digest("hex"),
    );
  });

  it("registers nothing for games that publish no verifier, which is every game today", async () => {
    const { frostbite } = await import("../../../configs/games/frostbite.ts");
    const { problems, registry } = await createGameVerifiers({
      games: [frostbite],
      playRoot: playRoot(),
    });
    expect(problems).toEqual([]);
    expect(registry.gameIds()).toEqual([]);
  });
});
