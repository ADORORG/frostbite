import {
  chainUnreachableWords,
  signatureMismatchWords,
} from "@ador/shared/chain-step-words";
import { gameAdminSubmitRefusals } from "@ador/shared/games";
import { describe, expect, it } from "vitest";

import { recordRefusalCopy, submitRefusalCopy } from "../src/domain/copy.ts";

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
});
