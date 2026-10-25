import { describe, expect, it } from "vitest";

import { authMethods, createHeldMethodKinds } from "../src/methods.ts";

describe("the sign-in methods this deployment offers", () => {
  it("are the wallet and the passkey, and both can start a session", () => {
    expect(authMethods.describe()).toEqual([
      { assurance: "strong", canSignIn: true, kind: "wallet" },
      { assurance: "strong", canSignIn: true, kind: "passkey" },
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
