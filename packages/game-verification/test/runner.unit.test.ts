import { describe, expect, it } from "vitest";

import { createInProcessRunner } from "../src/runner.ts";
import { buildArtifact, handWritten } from "./support/artifact.ts";

const runner = createInProcessRunner({ replayTimeoutMs: 300 });
const meta = JSON.stringify({ id: "x", version: 1 });

describe("the in-process runner", () => {
  it("loads a built artifact, and says what the rules are, what their sample is, and replays text as text", async () => {
    const { code } = await buildArtifact();
    const loaded = runner.load(code);
    expect(loaded.meta).toEqual({ id: "tally", version: 2 });
    const sample = JSON.parse(loaded.sample());
    expect(sample.gameId).toBe("tally-game");
    expect(JSON.parse(loaded.replay(JSON.stringify(sample)))).toEqual({
      earned: ["reached"],
      ok: true,
      score: null,
    });
  });

  it("gives each load a scope of its own, so two artifacts cannot see or change each other", () => {
    const first = runner.load(handWritten("() => 'one'", "{}", meta));
    const second = runner.load(handWritten("() => 'two'", "{}", meta));
    expect(first.replay("")).toBe("one");
    expect(second.replay("")).toBe("two");
    expect(Reflect.has(globalThis, "__frostbiteReplay")).toBe(false);
  });

  it("refuses a script that does not publish a verifier, naming nothing about it", () => {
    for (const code of [
      "",
      "var x = 1;",
      handWritten("'not a function'", "{}", meta),
      "globalThis.__frostbiteReplay = () => 'x'; globalThis.__frostbiteMeta = '{}';",
      handWritten("() => 'x'", "{}", "null"),
      handWritten("() => 'x'", "{}", JSON.stringify({ id: 1, version: 1 })),
      handWritten("() => 'x'", "{}", JSON.stringify({ id: "x" })),
      handWritten("() => 'x'", "{}", "not json"),
    ])
      expect(() => runner.load(code)).toThrow();
  });

  it("refuses an answer that is not text", () => {
    const loaded = runner.load(handWritten("() => 5", "{}", meta));
    expect(() => loaded.replay("{}")).toThrow("did not answer with text");
  });

  it("stops a replay that never returns, within its time limit, and a script that loops while loading", async () => {
    const { code } = await buildArtifact();
    const loaded = runner.load(code);
    const sample = JSON.parse(loaded.sample());
    const started = Date.now();
    expect(() =>
      loaded.replay(JSON.stringify({ ...sample, inputs: [{ type: "spin" }] })),
    ).toThrow();
    expect(Date.now() - started).toBeLessThan(3_000);
    expect(() => runner.load("for (;;) {}")).toThrow();
    // The artifact is still usable after one call was stopped.
    expect(JSON.parse(loaded.replay(JSON.stringify(sample))).ok).toBe(true);
  });

  it("does not hand the script the platform's own scope", () => {
    const loaded = runner.load(
      handWritten(
        "() => String(typeof process) + String(typeof require)",
        "{}",
        meta,
      ),
    );
    expect(loaded.replay("")).toBe("undefinedundefined");
  });
});
