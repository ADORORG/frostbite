import { describe, expect, it } from "vitest";

import { cabinet, combineCabinets } from "../src/cabinets.ts";
import { replayRecord } from "../src/replay.ts";
import type { GameVerifier, RunRecord } from "../src/run-record.ts";

// Two made-up cabinets with different states, so the combination cannot lean on a shared shape.
const counter: GameVerifier<number> = {
  earned: (total) => (total >= 2 ? ["counted"] : []),
  id: "counter",
  score: (total) => total,
  init: (seed, config) =>
    Object.keys(config).length > 0
      ? {
          ok: false,
          reason: `counter takes no setting: ${Object.keys(config).join()}`,
        }
      : { ok: true, state: seed },
  step: (total, input) =>
    input.type === "add"
      ? { ok: true, state: total + 1 }
      : { ok: false, reason: "counter only adds" },
  version: 1,
};
const words: GameVerifier<readonly string[]> = {
  earned: (said) => (said.length > 0 ? ["spoke"] : []),
  id: "words",
  init: () => ({ ok: true, state: [] }),
  step: (said, input) =>
    typeof input.data === "string"
      ? { ok: true, state: [...said, input.data] }
      : { ok: false, reason: "words takes text" },
  version: 1,
};
const rules = combineCabinets({
  cabinets: { counter: cabinet(counter), words: cabinet(words) },
  id: "arcade",
  version: 4,
});
const record = (
  config: RunRecord["config"],
  inputs: RunRecord["inputs"],
  seed = 0,
): RunRecord => ({
  claims: [],
  config,
  gameId: "arcade",
  inputs,
  schemaVersion: 1,
  seed,
  verifier: "arcade",
  verifierVersion: 4,
});

describe("combined cabinets", () => {
  it("is one verifier with the id and version it is given", () => {
    expect(rules.id).toBe("arcade");
    expect(rules.version).toBe(4);
  });

  it("replays a record under the cabinet it names, with that cabinet's own state", () => {
    expect(
      replayRecord(
        rules,
        record({ cabinet: "counter" }, [{ type: "add" }, { type: "add" }]),
      ),
    ).toEqual({ earned: ["counted"], ok: true, score: 2 });
    expect(
      replayRecord(
        rules,
        record({ cabinet: "words" }, [{ data: "hi", type: "say" }]),
      ),
    ).toEqual({ earned: ["spoke"], ok: true, score: null });
  });

  it("starts the cabinet from the record's seed", () => {
    expect(
      replayRecord(rules, record({ cabinet: "counter" }, [{ type: "add" }], 1)),
    ).toEqual({ earned: ["counted"], ok: true, score: 2 });
    expect(
      replayRecord(rules, record({ cabinet: "counter" }, [{ type: "add" }], 0)),
    ).toEqual({
      earned: [],
      ok: true,
      score: 1,
    });
  });

  it("hands the cabinet every setting but its own name", () => {
    expect(
      replayRecord(rules, record({ cabinet: "counter", extra: 1 }, [])),
    ).toMatchObject({
      detail: "counter takes no setting: extra",
      reason: "invalid-config",
    });
  });

  it.each([
    ["no cabinet", {}],
    ["a number", { cabinet: 1 }],
    ["an unknown name", { cabinet: "bank" }],
    ["a name the object inherits", { cabinet: "toString" }],
    ["a name from the prototype chain", { cabinet: "__proto__" }],
  ])("refuses %s, naming the cabinets there are", (_name, config) => {
    expect(replayRecord(rules, record(config, []))).toMatchObject({
      detail: "cabinet must be one of: counter, words",
      reason: "invalid-config",
    });
  });

  it("lets the cabinet refuse an input, and names the input's place in the record", () => {
    expect(
      replayRecord(
        rules,
        record({ cabinet: "counter" }, [{ type: "add" }, { type: "sub" }]),
      ),
    ).toEqual({
      detail: "counter only adds",
      index: 1,
      ok: false,
      reason: "illegal-input",
    });
  });
});
