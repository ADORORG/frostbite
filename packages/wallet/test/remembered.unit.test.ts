// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";

import {
  hasRememberedWallet,
  rememberedWalletKey,
} from "../src/client/remembered.ts";

afterEach(() => {
  localStorage.clear();
  vi.restoreAllMocks();
});

describe("a remembered wallet", () => {
  it("is the one the connection library stores, under the library's own key", () => {
    // The key is the library's (it writes "defaultWallet" when a wallet connects and removes it on disconnect), so
    // it is written out here, not read from the constant under test.
    localStorage.setItem("defaultWallet", "unisat");
    expect(hasRememberedWallet()).toBe(true);
    expect(rememberedWalletKey).toBe("defaultWallet");
  });

  it("is none until the library has stored one, and none again once it is cleared", () => {
    expect(hasRememberedWallet()).toBe(false);
    localStorage.setItem(rememberedWalletKey, "unisat");
    expect(hasRememberedWallet()).toBe(true);
    localStorage.removeItem(rememberedWalletKey);
    expect(hasRememberedWallet()).toBe(false);
  });

  it("is none when the stored value is empty", () => {
    localStorage.setItem(rememberedWalletKey, "");
    expect(hasRememberedWallet()).toBe(false);
  });

  it("is none, not an error, in a browser that refuses storage", () => {
    vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
      throw new Error("denied");
    });
    expect(hasRememberedWallet()).toBe(false);
  });
});
