import { describe, expect, it } from "vitest";

import {
  canonicalJson,
  createRunRecorder,
  maxRunClaims,
  maxRunInputs,
  runRecordSchema,
  type RunRecord,
} from "../src/run-record.ts";

const record = (over: Partial<RunRecord> = {}): RunRecord => ({
  claims: ["first-win"],
  config: { mines: 5 },
  gameId: "example-game",
  inputs: [{ data: 3, type: "pick" }, { type: "settle" }],
  schemaVersion: 1,
  seed: 12345,
  verifier: "tap-count",
  verifierVersion: 1,
  ...over,
});
const accepts = (value: unknown) => runRecordSchema.safeParse(value).success;

describe("the canonical form", () => {
  it("is the same text for the same value whatever order the keys were made in", () => {
    expect(
      canonicalJson({ b: 1, a: { d: [3, { y: 1, x: 2 }], c: null } }),
    ).toBe('{"a":{"c":null,"d":[3,{"x":2,"y":1}]},"b":1}');
    expect(canonicalJson({ a: 1, b: 2 })).toBe(canonicalJson({ b: 2, a: 1 }));
  });

  it("has no whitespace, and writes strings, numbers, booleans and null as JSON does", () => {
    expect(canonicalJson(["a b", 1.5, true, false, null, ""])).toBe(
      '["a b",1.5,true,false,null,""]',
    );
    expect(canonicalJson({ "k e y": "v\n" })).toBe('{"k e y":"v\\n"}');
    expect(canonicalJson([])).toBe("[]");
    expect(canonicalJson({})).toBe("{}");
  });

  it("sorts keys by their code units, so it does not depend on the locale", () => {
    expect(canonicalJson({ b: 1, B: 2, a: 3, "10": 4, "9": 5 })).toBe(
      '{"10":4,"9":5,"B":2,"a":3,"b":1}',
    );
  });
});

describe("the record schema", () => {
  it("accepts a well-formed record, and nothing more than it names", () => {
    expect(accepts(record())).toBe(true);
    expect(accepts({ ...record(), extra: 1 })).toBe(false);
    expect(accepts({ ...record(), inputs: [{ type: "pick", extra: 1 }] })).toBe(
      false,
    );
  });

  it("holds the seed to 32 bits and a whole number, so every engine reproduces it", () => {
    for (const seed of [0, 1, 0xffff_ffff])
      expect(accepts(record({ seed }))).toBe(true);
    for (const seed of [-1, 0x1_0000_0000, 1.5, Number.NaN])
      expect(accepts(record({ seed }))).toBe(false);
  });

  it("names its game, its verifier and the version of the rules in plain slugs", () => {
    for (const bad of ["", "Frostbite", "a b", "-x", "1x", "x".repeat(65)]) {
      expect(accepts(record({ gameId: bad }))).toBe(false);
      expect(accepts(record({ verifier: bad }))).toBe(false);
    }
    for (const version of [0, -1, 1.5, 0x1_0000])
      expect(accepts(record({ verifierVersion: version }))).toBe(false);
    expect(accepts(record({ schemaVersion: 2 as never }))).toBe(false);
  });

  it("bounds the inputs and the claims, and names an input kind in a slug", () => {
    const many = Array.from({ length: maxRunInputs }, () => ({ type: "pick" }));
    expect(accepts(record({ inputs: many }))).toBe(true);
    expect(accepts(record({ inputs: [...many, { type: "pick" }] }))).toBe(
      false,
    );
    const claims = Array.from(
      { length: maxRunClaims },
      (_, i) => `m-${String(i)}`,
    );
    expect(accepts(record({ claims }))).toBe(true);
    expect(accepts(record({ claims: [...claims, "one-more"] }))).toBe(false);
    expect(accepts(record({ inputs: [{ type: "Pick" }] }))).toBe(false);
    expect(accepts(record({ inputs: [{ type: "" }] }))).toBe(false);
  });

  it("takes only JSON as input data and config, nothing a script could carry", () => {
    expect(accepts(record({ config: { a: [1, { b: null }] } }))).toBe(true);
    expect(
      accepts({ ...record(), inputs: [{ data: () => 1, type: "pick" }] }),
    ).toBe(false);
    expect(accepts({ ...record(), config: { a: undefined } })).toBe(false);
    expect(accepts({ ...record(), config: { "": 1 } })).toBe(false);
  });
});

describe("the recorder", () => {
  const start = {
    config: { mines: 5 },
    gameId: "example-game",
    seed: 7,
    verifier: "tap-count",
    verifierVersion: 1,
  };

  it("builds the record the game played, in order, with and without data", () => {
    const recorder = createRunRecorder(start);
    recorder.input("pick", 3);
    recorder.input("settle");
    expect(recorder.finish(["first-win"])).toEqual({
      claims: ["first-win"],
      config: { mines: 5 },
      gameId: "example-game",
      inputs: [{ data: 3, type: "pick" }, { type: "settle" }],
      schemaVersion: 1,
      seed: 7,
      verifier: "tap-count",
      verifierVersion: 1,
    });
  });

  it("starts with no config when the game gives none", () => {
    const bare = {
      gameId: start.gameId,
      seed: start.seed,
      verifier: start.verifier,
      verifierVersion: start.verifierVersion,
    };
    expect(createRunRecorder(bare).finish([]).config).toEqual({});
  });

  it("refuses to finish a record the platform would refuse for its shape", () => {
    expect(() =>
      createRunRecorder({ ...start, seed: -1 }).finish([]),
    ).toThrow();
    expect(() => createRunRecorder(start).finish(["Not A Slug"])).toThrow();
  });

  it("refuses an input past the limit, rather than growing without end", () => {
    const recorder = createRunRecorder(start);
    for (let n = 0; n < maxRunInputs; n += 1) recorder.input("pick", n);
    expect(() => recorder.input("pick", 1)).toThrow(RangeError);
  });

  it("keeps what was recorded from being changed afterwards through the finished record", () => {
    const recorder = createRunRecorder(start);
    recorder.input("pick", 1);
    const first = recorder.finish([]);
    recorder.input("pick", 2);
    expect(first.inputs).toHaveLength(1);
    expect(recorder.finish([]).inputs).toHaveLength(2);
  });
});
