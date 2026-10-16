import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { gameManifestSchema } from "@ador/shared/games";
import { afterEach, describe, expect, it } from "vitest";

import {
  adderManifest,
  adderMilestone,
  adderRecord,
  publishAdderGame,
} from "../src/adder-game.ts";

const roots: string[] = [];
const newRoot = async () => {
  const root = await mkdtemp(join(tmpdir(), "adder-"));
  roots.push(root);
  return root;
};
afterEach(async () => {
  await Promise.all(roots.splice(0).map((r) => rm(r, { recursive: true })));
});

describe("adder game fixture", () => {
  it("builds its verifier where a built game is served, with the digest its manifest pins", async () => {
    const root = await newRoot();
    const { code, sha256 } = await publishAdderGame(root, "adder-one");
    expect(
      await readFile(join(root, "play", "adder-one", "verifier.js"), "utf8"),
    ).toBe(code);
    expect(code).toContain("adder-one");
    const manifest = adderManifest("adder-one", sha256);
    expect(gameManifestSchema.safeParse(manifest).success).toBe(true);
    expect(manifest.verification?.replay.sha256).toBe(sha256);
  });

  it("serves a file that no longer matches the digest when asked to alter it", async () => {
    const root = await newRoot();
    const { code } = await publishAdderGame(root, "adder-two", true);
    const served = await readFile(
      join(root, "play", "adder-two", "verifier.js"),
      "utf8",
    );
    expect(served).toBe(`${code}\n`);
  });

  it("describes a run as a game would send it", () => {
    expect(adderRecord("g", 7, [1, "x"])).toEqual({
      claims: [adderMilestone],
      config: {},
      gameId: "g",
      inputs: [
        { data: 1, type: "add" },
        { data: "x", type: "add" },
      ],
      schemaVersion: 1,
      seed: 7,
      verifier: "adder",
      verifierVersion: 1,
    });
    expect(adderRecord("g", 7, [], []).claims).toEqual([]);
  });
});
