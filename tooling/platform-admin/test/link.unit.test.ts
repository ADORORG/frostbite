import { describe, expect, it } from "vitest";

import {
  exitCodeOf,
  formatSetupLinkReport,
  mintSetupLink,
} from "../src/link.ts";

const expiresAt = new Date("2026-10-25T11:00:00.000Z");
const token = "abcDEF0123456789_-abcDEF0123456789_-abcdefg";

const minting = (kind: "minted" | "admin-exists") => ({
  mint: async () =>
    kind === "minted"
      ? ({ expiresAt, kind, token } as const)
      : ({ kind } as const),
});

describe("making the setup link", () => {
  it("puts the token after the # of the platform's own /setup address, where no server or log ever sees it", async () => {
    const report = await mintSetupLink({
      baseUrl: "https://launch.example.com",
      service: minting("minted"),
    });
    expect(report).toEqual({
      expiresAt,
      kind: "minted",
      url: `https://launch.example.com/setup#${token}`,
    });
    const url = new URL(report.kind === "minted" ? report.url : "");
    expect(url.search).toBe("");
    expect(url.pathname).toBe("/setup");
  });

  it("uses the platform's address however it is written, local ports included", async () => {
    const report = await mintSetupLink({
      baseUrl: "http://localhost:3000/",
      service: minting("minted"),
    });
    expect(report).toMatchObject({
      url: `http://localhost:3000/setup#${token}`,
    });
  });

  it("makes no link, and says setup is over, when an administrator already works", async () => {
    expect(
      await mintSetupLink({
        baseUrl: "https://launch.example.com",
        service: minting("admin-exists"),
      }),
    ).toEqual({ kind: "admin-exists" });
  });
});

describe("what the operator is told", () => {
  it("shows the link once with its expiry and the warnings that matter", () => {
    const text = formatSetupLinkReport({
      expiresAt,
      kind: "minted",
      url: `https://launch.example.com/setup#${token}`,
    });
    expect(text).toContain(`https://launch.example.com/setup#${token}`);
    expect(text).toContain("Valid until 2026-10-25T11:00:00.000Z");
    expect(text).toContain("single use");
    expect(text).toContain("Minting another link makes this one stop working");
  });

  it("explains a refusal without printing anything that could be used", () => {
    const text = formatSetupLinkReport({ kind: "admin-exists" });
    expect(text).toContain("administrator already exists");
    expect(text).not.toContain("/setup");
  });

  it("exits zero only when a link was made", () => {
    expect(
      exitCodeOf({
        expiresAt,
        kind: "minted",
        url: "https://x.example/setup#t",
      }),
    ).toBe(0);
    expect(exitCodeOf({ kind: "admin-exists" })).toBe(1);
  });
});
