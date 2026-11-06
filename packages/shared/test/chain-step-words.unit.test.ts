import { describe, expect, it } from "vitest";

import {
  chainUnreachableWords,
  signatureMismatchWords,
  submitRefusalReasons,
  submitRefusalWords,
} from "../src/chain/step-words.ts";

describe("the words around a transaction a person signs", () => {
  it("has words for every reason a signed transaction can be turned down for", () => {
    for (const subject of ["claim", "step"] as const) {
      const words = submitRefusalWords(subject);
      expect(Object.keys(words).sort()).toEqual(
        [...submitRefusalReasons].sort(),
      );
      for (const reason of submitRefusalReasons)
        expect(words[reason].length, `${subject} ${reason}`).toBeGreaterThan(
          20,
        );
    }
  });

  it("names the thing the feature calls it, in every sentence that needs a name, and never the other feature's", () => {
    for (const reason of [
      "expired",
      "not-awaiting-signature",
      "not-found",
    ] as const) {
      expect(submitRefusalWords("claim")[reason]).toContain("claim");
      expect(submitRefusalWords("claim")[reason]).not.toContain("step");
      expect(submitRefusalWords("step")[reason]).toContain("step");
      expect(submitRefusalWords("step")[reason]).not.toContain("claim");
    }
  });

  it("says the sentences that do not depend on the name the same for both, from the one place they are written", () => {
    for (const subject of ["claim", "step"] as const) {
      expect(submitRefusalWords(subject)["chain-unavailable"]).toBe(
        chainUnreachableWords,
      );
      expect(submitRefusalWords(subject)["invalid-signature"]).toBe(
        signatureMismatchWords,
      );
    }
  });

  it("says each thing once: no two reasons share a sentence", () => {
    for (const subject of ["claim", "step"] as const) {
      const sentences = Object.values(submitRefusalWords(subject));
      expect(new Set(sentences).size).toBe(sentences.length);
    }
  });
});
