import { createHash } from "node:crypto";
import {
  mkdir,
  mkdtemp,
  readFile,
  readdir,
  rm,
  writeFile,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { runInNewContext } from "node:vm";

import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { buildGame, bundleVerifier } from "../src/build.ts";

let scratch = "";
beforeEach(async () => {
  scratch = await mkdtemp(join(tmpdir(), "game-verifier-"));
});
afterEach(async () => rm(scratch, { force: true, recursive: true }));

const html =
  '<!doctype html><html><body><script src="main.js"></script></body></html>';
// The rules a game publishes: add 1 to 3 to a counter until it reaches the target.
const replaySource = `
import type { GameVerifier } from "@frostbite/game-sdk/run-record";
const rules: GameVerifier<{ count: number; target: number }> = {
  earned: ({ count, target }) => (count >= target ? ["reached"] : []),
  id: "counter",
  init: (_seed, config) =>
    typeof config.target === "number"
      ? { ok: true, state: { count: 0, target: config.target } }
      : { ok: false, reason: "a target is needed" },
  step: (state, input) =>
    input.type === "add" && typeof input.data === "number"
      ? { ok: true, state: { ...state, count: state.count + input.data } }
      : { ok: false, reason: "add takes a number" },
  version: 7,
};
export default rules;
export function sample() {
  return {
    claims: ["reached"],
    config: { target: 2 },
    gameId: "counting",
    inputs: [{ data: 2, type: "add" }],
    schemaVersion: 1 as const,
    seed: 1,
    verifier: "counter",
    verifierVersion: 7,
  };
}
`;

async function makeGame(replay?: string) {
  const directory = join(scratch, "games", "counting");
  await mkdir(join(directory, "src"), { recursive: true });
  await writeFile(join(directory, "index.html"), html);
  await writeFile(join(directory, "src", "main.ts"), "document.title = 'x';");
  if (replay !== undefined)
    await writeFile(join(directory, "src", "replay.ts"), replay);
  return directory;
}
const run = (code: string, record: unknown) => {
  const scope: Record<string, unknown> = {};
  runInNewContext(code, scope);
  const replay = scope.__frostbiteReplay as (text: string) => string;
  return JSON.parse(replay(JSON.stringify(record)));
};

describe("publishing a game's rules", () => {
  it("builds a script that replays a record as text, and says what the rules are and what the script's digest is", async () => {
    const directory = await makeGame(replaySource);
    const artifact = await bundleVerifier(directory);
    if (artifact === null) throw new Error("Expected an artifact");
    expect(artifact).toMatchObject({ id: "counter", version: 7 });
    expect(artifact.sha256).toBe(
      createHash("sha256").update(artifact.code).digest("hex"),
    );
    expect(artifact.bytes).toBe(new TextEncoder().encode(artifact.code).length);
    const sample = JSON.parse(
      String(
        (() => {
          const scope: Record<string, unknown> = {};
          runInNewContext(artifact.code, scope);
          return scope.__frostbiteSample;
        })(),
      ),
    );
    expect(run(artifact.code, sample)).toEqual({
      earned: ["reached"],
      ok: true,
    });
    expect(
      run(artifact.code, { ...sample, inputs: [{ type: "fly" }] }),
    ).toMatchObject({
      detail: "add takes a number",
      ok: false,
      reason: "illegal-input",
    });
  });

  it("builds the same script, with the same digest, each time", async () => {
    const directory = await makeGame(replaySource);
    const first = await bundleVerifier(directory);
    const second = await bundleVerifier(directory);
    expect(second?.sha256).toBe(first?.sha256);
  });

  it("publishes nothing for a game with no replay module, so its milestones stay self-reported", async () => {
    const directory = await makeGame();
    expect(await bundleVerifier(directory)).toBeNull();
    await buildGame({ directory, outDirectory: join(scratch, "out") });
    expect((await readdir(join(scratch, "out"))).sort()).toEqual([
      "index.html",
      "main.js",
    ]);
  });

  it("writes verifier.js and verifier.json next to the bundle, and the json matches the script", async () => {
    const directory = await makeGame(replaySource);
    await buildGame({ directory, outDirectory: join(scratch, "out") });
    const code = await readFile(join(scratch, "out", "verifier.js"), "utf8");
    const json = JSON.parse(
      await readFile(join(scratch, "out", "verifier.json"), "utf8"),
    );
    expect(json).toEqual({
      bytes: new TextEncoder().encode(code).length,
      id: "counter",
      sha256: createHash("sha256").update(code).digest("hex"),
      version: 7,
    });
  });

  it("gives an author a clear error, when the game is built, for a module that does not export the rules and a sample", async () => {
    const directory = await makeGame("export const nothing = 1;");
    await expect(bundleVerifier(directory)).rejects.toThrow(
      "it must export the rules as the default export and a sample() run",
    );
  });

  it("refuses rules that have no id or no version", async () => {
    const noVersion = replaySource.replace("  version: 7,\n", "");
    const directory = await makeGame(noVersion);
    await expect(bundleVerifier(directory)).rejects.toThrow(
      "the rules must have an id and a version",
    );
  });
});
