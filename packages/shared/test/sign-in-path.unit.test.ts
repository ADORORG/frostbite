import { describe, expect, it } from "vitest";

import {
  returnTarget,
  safeReturnPath,
  signInHref,
  signInPath,
} from "../src/auth/sign-in-path.ts";

describe("the path to come back to after signing in", () => {
  it("keeps a plain path on this site, with its query, and drops a fragment", () => {
    expect(safeReturnPath("/admin")).toBe("/admin");
    expect(safeReturnPath("/admin/games/frostbite")).toBe(
      "/admin/games/frostbite",
    );
    expect(safeReturnPath("/games?tab=top&page=2")).toBe(
      "/games?tab=top&page=2",
    );
    expect(safeReturnPath("/games#section")).toBe("/games");
  });

  it("falls back to the home page for nothing at all", () => {
    for (const raw of [undefined, null, "", "/"]) {
      expect(safeReturnPath(raw)).toBe("/");
    }
  });

  it("refuses to leave the site: other hosts, schemes and protocol-relative addresses", () => {
    for (const raw of [
      "https://evil.example/x",
      "http://evil.example",
      "//evil.example/x",
      "///evil.example",
      "/\\evil.example",
      "\\\\evil.example",
      "/.//evil.example",
      "/a/..//evil.example",
      "/./\\evil.example",
      "javascript:alert(1)",
      "data:text/html,<script>1</script>",
      "evil.example/path",
      "admin",
    ]) {
      expect(safeReturnPath(raw)).toBe("/");
    }
  });

  it("refuses control characters, spaces and tricks that browsers read as a different address", () => {
    for (const raw of [
      "/admin\n/x",
      "/admin\r\nSet-Cookie: a=b",
      "/ad min",
      "/admin\u0000",
      "/\t/evil.example",
      "/%5Cevil.example/..",
    ]) {
      // A percent-encoded backslash stays a harmless path segment; the rest are refused outright.
      const out = safeReturnPath(raw);
      expect(out === "/" || out.startsWith("/%5C")).toBe(true);
      expect(out).not.toContain("evil.example/x");
    }
    expect(safeReturnPath("/admin\n/x")).toBe("/");
    expect(safeReturnPath("/\t/evil.example")).toBe("/");
  });

  it("refuses an over-long value, and resolves dot segments inside the site", () => {
    expect(safeReturnPath(`/${"a".repeat(600)}`)).toBe("/");
    expect(safeReturnPath(`/${"a".repeat(511)}`)).toBe(`/${"a".repeat(511)}`);
    expect(safeReturnPath("/admin/../games")).toBe("/games");
    expect(safeReturnPath("/a/../../b")).toBe("/b");
  });

  it("never returns to the sign-in page, the API or the local stand-in, which would loop or expose them", () => {
    for (const raw of [
      "/sign-in",
      "/sign-in?returnTo=%2Fadmin",
      "/sign-in/x",
      "/api",
      "/api/v1/auth/methods",
      "/dev/sign-in",
    ]) {
      expect(safeReturnPath(raw)).toBe("/");
    }
    // A page whose name merely starts the same way is an ordinary page.
    expect(safeReturnPath("/sign-in-help")).toBe("/sign-in-help");
    expect(safeReturnPath("/apiary")).toBe("/apiary");
  });
});

describe("the sign-in page's address", () => {
  it("carries the page the visitor wanted, encoded, and nothing when there is none", () => {
    expect(signInHref("/admin/games?x=1")).toBe(
      `${signInPath}?returnTo=${encodeURIComponent("/admin/games?x=1")}`,
    );
    expect(signInHref("/")).toBe(signInPath);
  });

  it("does not carry a destination it would refuse", () => {
    expect(signInHref("https://evil.example")).toBe(signInPath);
    expect(signInHref("/sign-in")).toBe(signInPath);
  });

  it("is read back to the same destination", () => {
    const href = signInHref("/admin/games?x=1&y=2");
    expect(returnTarget(href.slice(href.indexOf("?")))).toBe(
      "/admin/games?x=1&y=2",
    );
  });
});

describe("where to go after signing in, from the page's query string", () => {
  it("is the safe return path, or home", () => {
    expect(returnTarget("?returnTo=%2Fadmin")).toBe("/admin");
    expect(returnTarget("")).toBe("/");
    expect(returnTarget("?other=1")).toBe("/");
    expect(returnTarget("?returnTo=https%3A%2F%2Fevil.example")).toBe("/");
    expect(returnTarget("?returnTo=%2F%2Fevil.example")).toBe("/");
  });
});
