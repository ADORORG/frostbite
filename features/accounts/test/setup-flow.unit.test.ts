import { ApiError } from "@ador/client-http";
import { describe, expect, it, vi } from "vitest";

import {
  redeemSavedToken,
  tokenFromAddress,
  type TokenStore,
} from "../src/setup/setup-flow.ts";

function storeHolding(token: string | null) {
  const store: TokenStore & { held: string | null } = {
    clear: vi.fn(() => {
      store.held = null;
    }),
    held: token,
    read: () => store.held,
    write: vi.fn((value: string) => {
      store.held = value;
    }),
  };
  return store;
}
const succeeds = async () => ({ status: "granted" as const });
const failsWith =
  (code: ConstructorParameters<typeof ApiError>[0]) => async () => {
    throw new ApiError(code, 400, `the server said ${code}`);
  };

describe("the token in the address", () => {
  it("is read after the # and only when it looks like a token", () => {
    expect(tokenFromAddress("#abc_DEF-123")).toBe("abc_DEF-123");
    expect(tokenFromAddress("")).toBeNull();
    expect(tokenFromAddress("#")).toBeNull();
    expect(tokenFromAddress("abc")).toBeNull();
    expect(tokenFromAddress("#has space")).toBeNull();
    expect(tokenFromAddress("#a/b")).toBeNull();
    expect(tokenFromAddress(`#${"a".repeat(257)}`)).toBeNull();
    expect(tokenFromAddress(`#${"a".repeat(256)}`)).toBe("a".repeat(256));
  });
});

describe("opening the saved link", () => {
  it("says there is no link, and asks nothing of the server, when nothing is saved", async () => {
    const redeem = vi.fn(succeeds);
    expect(
      await redeemSavedToken({ redeem, store: storeHolding(null) }),
    ).toEqual({
      kind: "no-link",
    });
    expect(redeem).not.toHaveBeenCalled();
  });

  it("is done only after the server accepted, and the token is dropped", async () => {
    const store = storeHolding("tok");
    const redeem = vi.fn(succeeds);
    expect(await redeemSavedToken({ redeem, store })).toEqual({ kind: "done" });
    expect(redeem).toHaveBeenCalledExactlyOnceWith("tok");
    expect(store.held).toBeNull();
  });

  it("asks the person to sign in when the server says nobody is, and keeps the token for afterwards", async () => {
    const store = storeHolding("tok");
    expect(
      await redeemSavedToken({ redeem: failsWith("unauthorized"), store }),
    ).toEqual({ kind: "sign-in" });
    expect(store.held).toBe("tok");
  });

  it("calls a link the server does not know invalid, and drops it so it is not tried again", async () => {
    const store = storeHolding("tok");
    expect(
      await redeemSavedToken({ redeem: failsWith("not_found"), store }),
    ).toEqual({ kind: "invalid" });
    expect(store.held).toBeNull();
  });

  it("relays what is missing, and keeps the token so the person can fix it and try again", async () => {
    const store = storeHolding("tok");
    expect(
      await redeemSavedToken({ redeem: failsWith("conflict"), store }),
    ).toEqual({ kind: "needs-method", message: "the server said conflict" });
    expect(store.held).toBe("tok");
  });

  it("reports other server failures with their message and keeps the token", async () => {
    const store = storeHolding("tok");
    expect(
      await redeemSavedToken({ redeem: failsWith("network"), store }),
    ).toEqual({ kind: "failed", message: "the server said network" });
    expect(store.held).toBe("tok");
  });

  it("reports a failure that is not the server's without leaking its detail", async () => {
    const store = storeHolding("tok");
    expect(
      await redeemSavedToken({
        redeem: async () => {
          throw new Error("secret internal detail");
        },
        store,
      }),
    ).toEqual({ kind: "failed", message: "Something went wrong." });
    expect(store.held).toBe("tok");
  });
});
