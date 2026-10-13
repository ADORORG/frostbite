import { describe, expect, it } from "vitest";

import { removalOutcome, type AccountMethod } from "../src/methods/rule.ts";

const wallet = (id: string): AccountMethod => ({
  canSignIn: true,
  id,
  kind: "wallet",
});
const passkey = (id: string): AccountMethod => ({
  canSignIn: false,
  id,
  kind: "passkey",
});
const email = (id: string): AccountMethod => ({
  canSignIn: true,
  id,
  kind: "email",
});

describe("whether a method may be removed from an account", () => {
  it("allows removing a wallet while another method can still sign in", () => {
    expect(
      removalOutcome([wallet("a"), wallet("b")], { id: "a", kind: "wallet" }),
    ).toBe("ok");
    expect(
      removalOutcome([wallet("a"), email("e")], { id: "a", kind: "wallet" }),
    ).toBe("ok");
  });

  it("refuses removing the only method that can sign in, even when passkeys remain", () => {
    expect(removalOutcome([wallet("a")], { id: "a", kind: "wallet" })).toBe(
      "final-method",
    );
    expect(
      removalOutcome([wallet("a"), passkey("p")], { id: "a", kind: "wallet" }),
    ).toBe("final-method");
  });

  it("allows removing a passkey, which cannot sign in, so long as something else can", () => {
    expect(
      removalOutcome([wallet("a"), passkey("p")], { id: "p", kind: "passkey" }),
    ).toBe("ok");
    expect(
      removalOutcome([wallet("a"), passkey("p"), passkey("q")], {
        id: "q",
        kind: "passkey",
      }),
    ).toBe("ok");
  });

  it("refuses removing a passkey from an account with nothing that can sign in", () => {
    expect(removalOutcome([passkey("p")], { id: "p", kind: "passkey" })).toBe(
      "final-method",
    );
  });

  it("says missing for a method the account does not have, whatever else it holds", () => {
    expect(removalOutcome([wallet("a")], { id: "z", kind: "wallet" })).toBe(
      "missing",
    );
    expect(removalOutcome([], { id: "a", kind: "wallet" })).toBe("missing");
    // The same id under another kind is a different method.
    expect(removalOutcome([wallet("a")], { id: "a", kind: "passkey" })).toBe(
      "missing",
    );
  });

  it("does not change what it is given", () => {
    const methods = [wallet("a"), wallet("b")];
    removalOutcome(methods, { id: "a", kind: "wallet" });
    expect(methods).toEqual([wallet("a"), wallet("b")]);
  });
});
