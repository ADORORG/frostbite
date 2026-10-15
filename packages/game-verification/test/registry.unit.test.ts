import { describe, expect, it } from "vitest";

import { createVerifierRegistry } from "../src/registry.ts";
import { defineVerifier } from "../src/verifier.ts";
import {
  counterRules,
  counterSample,
  crashingRules,
  crashingSample,
} from "./counter-game.ts";

const counter = defineVerifier(counterRules);
const crashing = defineVerifier(crashingRules);

describe("the verifier registry", () => {
  it("finds a game's verifier by the game a record names", () => {
    const registry = createVerifierRegistry([
      { gameId: "counting", sample: counterSample, verifier: counter },
      { gameId: "crashy", sample: crashingSample, verifier: crashing },
    ]);
    expect(registry.find("counting")).toEqual({
      gameId: "counting",
      sample: counterSample,
      verifier: counter,
    });
    expect(registry.find("nothing")).toBeUndefined();
    expect(registry.gameIds()).toEqual(["counting", "crashy"]);
  });

  it("refuses a game twice, so its verifier cannot be quietly replaced", () => {
    expect(() =>
      createVerifierRegistry([
        { gameId: "a", sample: counterSample, verifier: counter },
        { gameId: "a", sample: counterSample, verifier: crashing },
      ]),
    ).toThrow("registered twice");
    // Two games may name their rules alike without being mistaken for each other.
    expect(
      createVerifierRegistry([
        { gameId: "a", sample: counterSample, verifier: counter },
        { gameId: "b", sample: counterSample, verifier: counter },
      ]).gameIds(),
    ).toEqual(["a", "b"]);
  });

  it("can be empty", () => {
    expect(createVerifierRegistry([]).gameIds()).toEqual([]);
  });
});
