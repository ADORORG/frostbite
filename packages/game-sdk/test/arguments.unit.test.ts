import { describe, expect, it } from "vitest";

import { argumentProblem } from "../src/arguments.ts";

describe("what a command says about arguments it cannot read", () => {
  it("gives the reason, then how to use the command", () => {
    expect(
      argumentProblem(new Error("Unknown option '--x'"), "Usage: cmd"),
    ).toBe("Unknown option '--x'\nUsage: cmd");
  });

  it("still says something when the failure was not an error", () => {
    expect(argumentProblem("odd", "Usage: cmd")).toBe(
      "The arguments are not valid.\nUsage: cmd",
    );
  });
});
