import { BuildRefusedError, ChainUnavailableError } from "@ador/chain/ports";
import { describe, expect, it } from "vitest";

import { buildFailure, contractRefusal } from "../src/start-failures.ts";

describe("what the contract refused", () => {
  it.each([
    ["claims are paused", "claims-paused"],
    ["unknown milestone", "milestone-not-defined"],
    ["claim limit reached", "limit-reached"],
    ["Error: Claims Are Paused", "claims-paused"],
    ["milestone already defined", "contract-refused"],
    ["", "contract-refused"],
  ] as const)("reads %j as %s", (said, code) => {
    expect(contractRefusal(said)).toBe(code);
  });
});

describe("why a claim could not be built", () => {
  it("says a wallet without coins and a fee above the limit apart, as things the player can act on", () => {
    expect(
      buildFailure(new BuildRefusedError("insufficient-funds", "m")),
    ).toEqual({ code: "no-funds", expected: true });
    expect(buildFailure(new BuildRefusedError("fee-above-limit", "m"))).toEqual(
      { code: "fee-too-high", expected: true },
    );
  });

  it("says an index that is behind the chain, which is a state with a remedy and not a failure to look into", () => {
    expect(buildFailure(new ChainUnavailableError("behind", "behind"))).toEqual(
      { code: "index-behind", expected: true },
    );
    expect(buildFailure(new ChainUnavailableError("unreachable"))).toEqual({
      code: "chain-unavailable",
      expected: false,
    });
  });

  it("takes every other failure as the chain being unavailable, to be looked into", () => {
    for (const error of [
      new BuildRefusedError("invalid-request", "m"),
      new BuildRefusedError("unsupported-operation", "m"),
      new Error("the node is down"),
      "not an error",
    ]) {
      expect(buildFailure(error)).toEqual({
        code: "chain-unavailable",
        expected: false,
      });
    }
  });
});
