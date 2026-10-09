import { describe, expect, it, vi } from "vitest";

import { chooseImage, signIn } from "../src/upload-helpers.ts";

describe("upload page test helpers", () => {
  it("signs the page's context in with the session token for the base URL", async () => {
    const context = {
      addCookies: vi.fn(async () => undefined),
      clearCookies: vi.fn(async () => undefined),
    };
    await signIn({ context: () => context }, "https://localhost:4173", {
      sessionToken: "token-value",
    });
    expect(context.clearCookies).toHaveBeenCalledOnce();
    expect(context.addCookies).toHaveBeenCalledWith([
      expect.objectContaining({ domain: "localhost", value: "token-value" }),
    ]);
  });

  it("refuses to sign in without a configured base URL", async () => {
    const context = {
      addCookies: vi.fn(async () => undefined),
      clearCookies: vi.fn(async () => undefined),
    };
    await expect(
      signIn({ context: () => context }, undefined, { sessionToken: "t" }),
    ).rejects.toThrow("base URL");
    expect(context.addCookies).not.toHaveBeenCalled();
  });

  it("hands the file to the page's file input", async () => {
    const setInputFiles = vi.fn(async () => undefined);
    const locator = vi.fn(() => ({ setInputFiles }));
    const buffer = Buffer.from("x");
    await chooseImage({ locator }, "a.png", "image/png", buffer);
    expect(locator).toHaveBeenCalledWith('input[type="file"]');
    expect(setInputFiles).toHaveBeenCalledWith({
      buffer,
      mimeType: "image/png",
      name: "a.png",
    });
  });
});
