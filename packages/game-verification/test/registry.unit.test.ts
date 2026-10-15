import { describe, expect, it } from "vitest";

import { createVerifierRegistry } from "../src/registry.ts";
import { defineVerifier } from "../src/verifier.ts";
import { counterRules, crashingRules } from "./counter-game.ts";

const counter = defineVerifier(counterRules);
const crashing = defineVerifier(crashingRules);

describe("the verifier registry", () => {
  it("finds a verifier by the id a record names, with the game it belongs to", () => {
    const registry = createVerifierRegistry([
      { gameId: "counting", verifier: counter },
      { gameId: "crashy", verifier: crashing },
    ]);
    expect(registry.find("counter")).toEqual({
      gameId: "counting",
      verifier: counter,
    });
    expect(registry.find("nothing")).toBeUndefined();
    expect(registry.ids()).toEqual(["counter", "crashing"]);
  });

  it("refuses the same id twice, so a verifier cannot be quietly replaced", () => {
    expect(() =>
      createVerifierRegistry([
        { gameId: "a", verifier: counter },
        { gameId: "b", verifier: counter },
      ]),
    ).toThrow("registered twice");
  });

  it("can be empty", () => {
    expect(createVerifierRegistry([]).ids()).toEqual([]);
  });
});
