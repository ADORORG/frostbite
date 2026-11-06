import {
  chainUnreachableWords,
  signatureMismatchWords,
} from "@frostbite/shared/chain-step-words";
import { gameAdminSubmitRefusals } from "@frostbite/shared/games";
import { describe, expect, it } from "vitest";

import {
  recordRefusalCopy,
  startRefusalCopy,
  submitRefusalCopy,
} from "../src/domain/copy.ts";

describe("why the platform turned down what staff signed", () => {
  it("has words, about a step, for every reason a signed step is turned down", () => {
    expect(Object.keys(submitRefusalCopy).sort()).toEqual(
      [...gameAdminSubmitRefusals].sort(),
    );
    expect(submitRefusalCopy.expired).toContain("step");
    expect(submitRefusalCopy["not-found"]).toContain("step");
  });

  it("says the network is gone, and the signature is not what was shown, in the platform's one wording", () => {
    expect(submitRefusalCopy["chain-unavailable"]).toBe(chainUnreachableWords);
    expect(submitRefusalCopy["invalid-signature"]).toBe(signatureMismatchWords);
    expect(recordRefusalCopy["chain-unavailable"]).toBe(chainUnreachableWords);
    expect(recordRefusalCopy["not-found"]).toBe(submitRefusalCopy["not-found"]);
  });

  it("says a game that already has its contract the same whether the step or the address was refused", () => {
    expect(recordRefusalCopy["already-created"]).toBe(
      startRefusalCopy["already-created"],
    );
    expect(startRefusalCopy["already-created"]).toContain("contract");
  });
});
