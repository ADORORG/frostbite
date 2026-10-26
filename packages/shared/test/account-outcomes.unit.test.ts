import { describe, expect, it } from "vitest";

import {
  accountOutcomes,
  isAccountOutcome,
  outcomeMessage,
  type AccountOutcome,
} from "../src/accounts/outcomes.ts";
import { httpErrorReasonSchema } from "../src/http/index.ts";

const names = Object.keys(accountOutcomes) as AccountOutcome[];

describe("the catalogue of account outcomes", () => {
  it("gives every outcome a reason the error envelope accepts, and words", () => {
    for (const name of names) {
      expect(httpErrorReasonSchema.safeParse(name).success, name).toBe(true);
      expect(accountOutcomes[name].message.trim().length, name).toBeGreaterThan(
        8,
      );
      expect(accountOutcomes[name].message.length, name).toBeLessThanOrEqual(
        256,
      );
    }
  });

  it("says each thing once: no two outcomes share a sentence", () => {
    const sentences = names.map((name) => accountOutcomes[name].message);
    expect(new Set(sentences).size).toBe(sentences.length);
  });

  it("never says whose a wallet or an address is", () => {
    for (const name of names) {
      expect(accountOutcomes[name].message, name).not.toMatch(
        /[0-9a-f]{8}-[0-9a-f]{4}|@.+\.|\b(bc1|tb1)/iu,
      );
    }
  });

  it("knows which outcomes are only ever the browser's: they have no status class", () => {
    const browserOnly = names.filter(
      (name) => accountOutcomes[name].http === null,
    );
    expect(browserOnly.sort()).toEqual(
      [
        "network",
        "passkey-cancelled",
        "passkey-unsupported",
        "wallet-changed",
        "wallet-not-connected",
        "wallet-refused",
      ].sort(),
    );
  });

  it("recognises only its own reasons, and nothing a server or a page merely says", () => {
    expect(isAccountOutcome("wallet-held")).toBe(true);
    expect(isAccountOutcome("toString")).toBe(false);
    expect(isAccountOutcome("constructor")).toBe(false);
    expect(isAccountOutcome("not-a-reason")).toBe(false);
    expect(isAccountOutcome(null)).toBe(false);
  });

  it("uses the server's words only where the catalogue says the server knows more", () => {
    expect(outcomeMessage("code-too-soon", "Ask again in 30 seconds.")).toBe(
      "Ask again in 30 seconds.",
    );
    expect(outcomeMessage("code-too-soon")).toBe(
      accountOutcomes["code-too-soon"].message,
    );
    // A server's sentence never replaces the catalogue's for an outcome that does not ask for it.
    expect(outcomeMessage("wallet-held", "something else")).toBe(
      accountOutcomes["wallet-held"].message,
    );
  });
});
