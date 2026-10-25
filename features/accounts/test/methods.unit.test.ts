import { describe, expect, it } from "vitest";

import { createAuthMethods, createHeldMethodKinds } from "../src/methods.ts";

describe("the sign-in methods this deployment offers", () => {
  it("are the wallet and the passkey, and both can start a session", () => {
    expect(createAuthMethods({ email: false }).describe()).toEqual([
      { assurance: "strong", canSignIn: true, kind: "wallet" },
      { assurance: "strong", canSignIn: true, kind: "passkey" },
    ]);
  });

  it("include email, a standard-assurance way in, only where mail is set up", () => {
    expect(createAuthMethods({ email: true }).describe()).toEqual([
      { assurance: "strong", canSignIn: true, kind: "wallet" },
      { assurance: "strong", canSignIn: true, kind: "passkey" },
      { assurance: "standard", canSignIn: true, kind: "email" },
    ]);
  });

  it("reduces an account's listed methods to the set of kinds it holds", async () => {
    const context = "the caller's transaction";
    const held = createHeldMethodKinds({
      list: async (received, userId) => {
        expect(received).toBe(context);
        return userId === "u1"
          ? [
              { assurance: "strong", canSignIn: true, id: "a", kind: "wallet" },
              { assurance: "strong", canSignIn: true, id: "b", kind: "wallet" },
            ]
          : [];
      },
    });
    expect(await held(context, "u1")).toEqual(new Set(["wallet"]));
    expect(await held(context, "u2")).toEqual(new Set());
  });
});
