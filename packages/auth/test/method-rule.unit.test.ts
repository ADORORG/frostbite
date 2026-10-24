import { describe, expect, it } from "vitest";

import type { LinkedMethod } from "../src/methods/contracts.ts";
import {
  holdsMethod,
  meetsAssurance,
  removalOutcome,
} from "../src/methods/rule.ts";

const wallet = (id: string): LinkedMethod => ({
  assurance: "strong",
  canSignIn: true,
  id,
  kind: "wallet",
});
const passkey = (id: string): LinkedMethod => ({
  assurance: "strong",
  canSignIn: false,
  id,
  kind: "passkey",
});
const email = (id: string): LinkedMethod => ({
  assurance: "standard",
  canSignIn: true,
  id,
  kind: "email",
});
// A kind the rules have never heard of: they must treat it like any other.
const phone = (id: string): LinkedMethod => ({
  assurance: "basic",
  canSignIn: true,
  id,
  kind: "phone",
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

  it("says missing for a method the account does not have, whatever else it holds, and the same again when repeated", () => {
    expect(removalOutcome([wallet("a")], { id: "z", kind: "wallet" })).toBe(
      "missing",
    );
    expect(removalOutcome([], { id: "a", kind: "wallet" })).toBe("missing");
    // The same id under another kind is a different method.
    expect(removalOutcome([wallet("a")], { id: "a", kind: "passkey" })).toBe(
      "missing",
    );
    const methods = [wallet("a")];
    const removing = { id: "gone", kind: "wallet" };
    expect(removalOutcome(methods, removing)).toBe(
      removalOutcome(methods, removing),
    );
  });

  it("treats a kind it has never heard of like any other", () => {
    expect(
      removalOutcome([wallet("a"), phone("n")], { id: "n", kind: "phone" }),
    ).toBe("ok");
    expect(removalOutcome([phone("n")], { id: "n", kind: "phone" })).toBe(
      "final-method",
    );
  });

  it("does not change what it is given", () => {
    const methods = [wallet("a"), wallet("b")];
    const before = JSON.stringify(methods);
    removalOutcome(methods, { id: "a", kind: "wallet" });
    expect(JSON.stringify(methods)).toBe(before);
  });
});

describe("whether an account holds a kind of method", () => {
  it("is true only for a kind it has, and false for none at all", () => {
    expect(holdsMethod([email("e"), wallet("a")], "wallet")).toBe(true);
    expect(holdsMethod([email("e")], "wallet")).toBe(false);
    expect(holdsMethod([], "wallet")).toBe(false);
    expect(holdsMethod([phone("n")], "phone")).toBe(true);
  });
});

describe("whether an account holds a method of at least an assurance level", () => {
  it("counts a method at or above the level, and none below it", () => {
    expect(meetsAssurance([phone("n")], "basic")).toBe(true);
    expect(meetsAssurance([phone("n")], "standard")).toBe(false);
    expect(meetsAssurance([email("e")], "standard")).toBe(true);
    expect(meetsAssurance([email("e")], "strong")).toBe(false);
    expect(meetsAssurance([email("e"), passkey("p")], "strong")).toBe(true);
    expect(meetsAssurance([], "basic")).toBe(false);
  });

  it("counts a strong method that cannot sign in yet: holding is what is asked", () => {
    expect(meetsAssurance([passkey("p")], "strong")).toBe(true);
  });
});
