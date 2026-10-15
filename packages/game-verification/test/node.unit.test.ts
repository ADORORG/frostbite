import { createHash } from "node:crypto";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { adderManifest, publishAdderGame } from "@ador/test-kit/adder-game";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { createGameVerifiers } from "../src/node.ts";
import { verifyRun } from "../src/verify.ts";

let scratch = "";
beforeEach(async () => {
  scratch = await mkdtemp(join(tmpdir(), "play-root-"));
});
afterEach(async () => rm(scratch, { force: true, recursive: true }));

const publish = (gameId: string, tamper = false) =>
  publishAdderGame(scratch, gameId, tamper);
const manifest = adderManifest;
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
    // The second game serves the first game's file, whose sample run names the first game.
    await mkdir(join(playRoot(), "second-adder"), { recursive: true });
    await writeFile(
      join(playRoot(), "second-adder", "verifier.js"),
      built.code,
    );
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

  it("registers nothing for a game that publishes no verifier", async () => {
    const { problems, registry } = await createGameVerifiers({
      games: [
        {
          ...manifest("plain-game", "0".repeat(64)),
          capabilities: [],
          milestones: [],
          verification: undefined,
        },
      ],
      playRoot: playRoot(),
    });
    expect(problems).toEqual([]);
    expect(registry.gameIds()).toEqual([]);
  });
});
