import { describe, expect, it } from "vitest";

import type { MethodAdapter } from "../src/methods/contracts.ts";
import { createMethodRegistry } from "../src/methods/registry.ts";
import { removalOutcome } from "../src/methods/rule.ts";

type Context = { readonly accounts: Record<string, Record<string, string[]>> };

// An adapter over an in-memory account store: no database, no wallet, only the port.
function adapter(
  kind: string,
  over: Partial<MethodAdapter<Context>> = {},
): MethodAdapter<Context> {
  return {
    assurance: "strong",
    canSignIn: true,
    kind,
    list: async (context, userId) => context.accounts[userId]?.[kind] ?? [],
    ...over,
  };
}

const context: Context = {
  accounts: {
    alice: { email: ["b@x", "a@x"], passkey: ["p1"], wallet: ["w1"] },
  },
};

describe("the registry of sign-in methods", () => {
  it("lists what the account has from every adapter, in registration order and then by id, with each kind's capabilities", async () => {
    const registry = createMethodRegistry([
      adapter("wallet"),
      adapter("passkey", { canSignIn: false }),
      adapter("email", { assurance: "standard" }),
    ]);
    expect(await registry.list(context, "alice")).toEqual([
      { assurance: "strong", canSignIn: true, id: "w1", kind: "wallet" },
      { assurance: "strong", canSignIn: false, id: "p1", kind: "passkey" },
      { assurance: "standard", canSignIn: true, id: "a@x", kind: "email" },
      { assurance: "standard", canSignIn: true, id: "b@x", kind: "email" },
    ]);
    expect(await registry.list(context, "nobody")).toEqual([]);
  });

  it("describes the kinds it offers, without anything of an account", () => {
    const registry = createMethodRegistry([
      adapter("wallet"),
      adapter("phone", { assurance: "basic" }),
    ]);
    expect(registry.describe()).toEqual([
      { assurance: "strong", canSignIn: true, kind: "wallet" },
      { assurance: "basic", canSignIn: true, kind: "phone" },
    ]);
  });

  it("takes a new method with no change anywhere else: the rules and the listing handle a kind added later", async () => {
    // Phone is not known to the registry, the rules or any repository; it is only registered.
    const registry = createMethodRegistry([
      adapter("wallet"),
      adapter("phone", { assurance: "basic" }),
    ]);
    const methods = await registry.list(
      { accounts: { carol: { phone: ["+2348000000000"], wallet: ["w9"] } } },
      "carol",
    );
    expect(methods.map(({ kind }) => kind)).toEqual(["wallet", "phone"]);
    expect(
      removalOutcome(methods, { id: "+2348000000000", kind: "phone" }),
    ).toBe("ok");
  });

  it("refuses at boot a repeated kind, a malformed kind, an empty set, and a set in which nothing can sign in", () => {
    expect(() =>
      createMethodRegistry([adapter("wallet"), adapter("wallet")]),
    ).toThrow("registered twice");
    for (const kind of ["Wallet", "w", "1wallet", "wal let", ""]) {
      expect(() => createMethodRegistry([adapter(kind)])).toThrow();
    }
    expect(() => createMethodRegistry([])).toThrow("able to sign in");
    expect(() =>
      createMethodRegistry([adapter("passkey", { canSignIn: false })]),
    ).toThrow("able to sign in");
  });

  it("refuses an adapter that lists an empty or repeated id, rather than let the rules count it wrong", async () => {
    const empty = createMethodRegistry([
      adapter("wallet", { list: async () => [""] }),
    ]);
    await expect(empty.list(context, "alice")).rejects.toThrow(
      "empty or repeated",
    );
    const repeated = createMethodRegistry([
      adapter("wallet", { list: async () => ["w1", "w1"] }),
    ]);
    await expect(repeated.list(context, "alice")).rejects.toThrow(
      "empty or repeated",
    );
  });

  it("passes the caller's context and the user through to each adapter untouched", async () => {
    const seen: unknown[] = [];
    const registry = createMethodRegistry([
      adapter("wallet", {
        list: async (given, userId) => {
          seen.push(given, userId);
          return [];
        },
      }),
    ]);
    await registry.list(context, "alice");
    expect(seen[0]).toBe(context);
    expect(seen[1]).toBe("alice");
  });

  it("names an account by the first method that has a name for it, in registration order, and by nothing when none does", async () => {
    const registry = createMethodRegistry([
      adapter("wallet", { label: async () => null }),
      adapter("passkey"),
      adapter("email", { label: async (_c, userId) => `${userId}@x` }),
      adapter("phone", { label: async () => "never reached" }),
    ]);
    expect(await registry.label(context, "alice")).toBe("alice@x");
    expect(
      await createMethodRegistry([adapter("wallet")]).label(context, "alice"),
    ).toBeNull();
  });

  it("finds the accounts any method finds for the text, each once, and none from a method that cannot look", async () => {
    const registry = createMethodRegistry([
      adapter("wallet", {
        lookup: async (_c, text) => (text === "t" ? ["a", "b"] : []),
      }),
      adapter("passkey"),
      adapter("email", {
        lookup: async (_c, text) => (text === "t" ? ["b", "c"] : []),
      }),
    ]);
    expect(await registry.lookup(context, "t")).toEqual(["a", "b", "c"]);
    expect(await registry.lookup(context, "other")).toEqual([]);
    expect(
      await createMethodRegistry([adapter("wallet")]).lookup(context, "t"),
    ).toEqual([]);
  });
});
