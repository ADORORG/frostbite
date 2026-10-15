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
  it("finds a verifier by the id a record names, with the game it belongs to", () => {
    const registry = createVerifierRegistry([
      { gameId: "counting", sample: counterSample, verifier: counter },
      { gameId: "crashy", sample: crashingSample, verifier: crashing },
    ]);
    expect(registry.find("counter")).toEqual({
      gameId: "counting",
      sample: counterSample,
      verifier: counter,
    });
    expect(registry.find("nothing")).toBeUndefined();
    expect(registry.ids()).toEqual(["counter", "crashing"]);
  });

  it("refuses the same id twice, so a verifier cannot be quietly replaced", () => {
    expect(() =>
      createVerifierRegistry([
        { gameId: "a", sample: counterSample, verifier: counter },
        { gameId: "b", sample: counterSample, verifier: counter },
      ]),
    ).toThrow("registered twice");
  });

  it("can be empty", () => {
    expect(createVerifierRegistry([]).ids()).toEqual([]);
  });
});
