// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { createSessionTokenStore } from "../src/setup/token-store.ts";

beforeEach(() => window.sessionStorage.clear());
afterEach(() => vi.restoreAllMocks());

describe("the saved setup token", () => {
  it("lives in session storage, so a reload of the tab still finds it", () => {
    createSessionTokenStore().write("tok");
    expect(window.sessionStorage.getItem("platform-setup-token")).toBe("tok");
    expect(createSessionTokenStore().read()).toBe("tok");
  });

  it("is gone once cleared, from storage and from memory", () => {
    const store = createSessionTokenStore();
    store.write("tok");
    store.clear();
    expect(store.read()).toBeNull();
    expect(window.sessionStorage.getItem("platform-setup-token")).toBeNull();
  });

  it("is kept in memory for the page when the browser refuses storage, and still clears", () => {
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new DOMException("denied", "SecurityError");
    });
    vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
      throw new DOMException("denied", "SecurityError");
    });
    vi.spyOn(Storage.prototype, "removeItem").mockImplementation(() => {
      throw new DOMException("denied", "SecurityError");
    });
    const store = createSessionTokenStore();
    store.write("tok");
    expect(store.read()).toBe("tok");
    store.clear();
    expect(store.read()).toBeNull();
  });
});
