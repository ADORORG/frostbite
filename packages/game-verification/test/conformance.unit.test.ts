import type { RunRecord } from "@frostbite/game-sdk/run-record";
import { describe, expect, it } from "vitest";

import { runVerifierConformance } from "../src/conformance.ts";
import { defineVerifier, type GameVerifier } from "../src/verifier.ts";
import { counterRules, counterSample } from "./counter-game.ts";

const sample: RunRecord = counterSample;
const failures = <State>(rules: GameVerifier<State>, record = sample) =>
  runVerifierConformance({
    gameId: "counting",
    sample: record,
    verifier: defineVerifier(rules),
  })
    .filter(({ ok }) => !ok)
    .map(({ name }) => name);

describe("the verifier conformance checks", () => {
  it("pass a well-behaved game, all of them, each with its name", () => {
    const checks = runVerifierConformance({
      gameId: "counting",
      sample,
      verifier: defineVerifier(counterRules),
    });
    expect(checks.every(({ ok }) => ok)).toBe(true);
    expect(checks.map(({ name }) => name)).toEqual([
      "verifies its own sample run",
      "refuses a claim the run did not earn",
      "refuses an input the game does not have",
      "gives the same verdict every time",
      "uses neither the clock nor randomness",
      "answers a verdict, never an error, for odd inputs",
    ]);
  });

  it("fail a sample that is not a legal run of the game, or claims what it did not earn", () => {
    expect(
      failures(counterRules, { ...sample, inputs: [{ data: 9, type: "add" }] }),
    ).toContain("verifies its own sample run");
    expect(
      failures(counterRules, { ...sample, claims: ["perfect"] }),
    ).toContain("verifies its own sample run");
  });

  it("fail rules that earn a milestone nobody could have", () => {
    const generous: GameVerifier<number> = {
      earned: () => ["reached", "no-such-milestone"],
      id: "counter",
      init: () => ({ ok: true, state: 0 }),
      step: (state, input) =>
        input.type === "add"
          ? { ok: true, state }
          : { ok: false, reason: "no" },
      version: 1,
    };
    expect(failures(generous)).toContain(
      "refuses a claim the run did not earn",
    );
  });

  it("fail rules that accept an input they do not have", () => {
    const lax: GameVerifier<number> = {
      earned: () => ["reached"],
      id: "counter",
      init: () => ({ ok: true, state: 0 }),
      step: (state) => ({ ok: true, state }),
      version: 1,
    };
    expect(failures(lax)).toContain("refuses an input the game does not have");
  });

  it("fail rules that read the clock or use randomness", () => {
    const clock: GameVerifier<number> = {
      earned: () => (Date.now() > 0 ? ["reached"] : []),
      id: "counter",
      init: () => ({ ok: true, state: 0 }),
      step: (state, input) =>
        input.type === "add"
          ? { ok: true, state }
          : { ok: false, reason: "no" },
      version: 1,
    };
    expect(failures(clock)).toContain("uses neither the clock nor randomness");
    const random: GameVerifier<number> = {
      ...clock,
      earned: () => (Math.random() >= 0 ? ["reached"] : []),
    };
    expect(failures(random)).toContain("uses neither the clock nor randomness");
  });

  it("fail rules that give a different answer each time", () => {
    let calls = 0;
    const flaky: GameVerifier<number> = {
      earned: () => (calls % 2 === 0 ? ["reached"] : ["reached", "exact"]),
      id: "counter",
      init: () => {
        calls += 1;
        return { ok: true, state: 0 };
      },
      step: (state) => ({ ok: true, state }),
      version: 1,
    };
    expect(failures(flaky)).toContain("gives the same verdict every time");
  });

  it("fail rules that fall over on an odd input instead of refusing it", () => {
    const fragile: GameVerifier<number> = {
      earned: () => ["reached"],
      id: "counter",
      init: () => ({ ok: true, state: 0 }),
      step: (state, input) => {
        if (input.type === "add") return { ok: true, state };
        if (typeof input.data !== "number") throw new TypeError("odd");
        return { ok: false, reason: "no" };
      },
      version: 1,
    };
    expect(failures(fragile)).toContain(
      "answers a verdict, never an error, for odd inputs",
    );
  });

  it("restore the clock and Math.random even when the rules throw", () => {
    const now = Date.now;
    const random = Math.random;
    failures({
      earned: () => [],
      id: "counter",
      init: () => ({ ok: true, state: 0 }),
      step: () => {
        throw new Error("x");
      },
      version: 1,
    });
    expect(Date.now).toBe(now);
    expect(Math.random).toBe(random);
  });

  it("report something thrown that is not an error, too", () => {
    const checks = runVerifierConformance({
      gameId: "counting",
      sample: {
        ...sample,
        get claims(): string[] {
          throw "not an error object";
        },
      },
      verifier: defineVerifier(counterRules),
    });
    expect(checks.some(({ detail, ok }) => !ok && detail === "threw")).toBe(
      true,
    );
  });

  it("report a check that itself throws as a failure with the reason", () => {
    const checks = runVerifierConformance({
      gameId: "counting",
      sample: {
        ...sample,
        get claims(): string[] {
          throw new Error("no claims here");
        },
      },
      verifier: defineVerifier(counterRules),
    });
    expect(
      checks.some(({ detail, ok }) => !ok && detail === "no claims here"),
    ).toBe(true);
  });
});
