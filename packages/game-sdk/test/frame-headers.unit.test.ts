import { describe, expect, it } from "vitest";

import {
  gameContentSecurityPolicy,
  gameResponseHeaders,
} from "../src/frame-headers.ts";

const directives = new Map(
  gameContentSecurityPolicy.split("; ").map((part) => {
    const [name = "", ...sources] = part.split(" ");
    return [name, sources.join(" ")] as const;
  }),
);

describe("the headers a game's files are served with", () => {
  it("sandbox the page without letting it keep the platform's origin", () => {
    expect(directives.get("sandbox")).toBe("allow-scripts");
    expect(gameContentSecurityPolicy).not.toContain("allow-same-origin");
  });

  it.each([
    ["connect-src", "'none'"],
    ["form-action", "'none'"],
    ["frame-src", "'none'"],
    ["object-src", "'none'"],
    ["base-uri", "'none'"],
    ["default-src", "'none'"],
  ])("deny %s", (name, value) => {
    expect(directives.get(name)).toBe(value);
  });

  it("allow scripts and styles only from the game's own files, and no inline script", () => {
    expect(directives.get("script-src")).toBe("'self'");
    expect(directives.get("style-src")).toBe("'self'");
    expect(gameContentSecurityPolicy).not.toContain("unsafe");
  });

  it("let only the platform's own pages frame the game", () => {
    expect(directives.get("frame-ancestors")).toBe("'self'");
    const headers = new Map(
      gameResponseHeaders().map(({ key, value }) => [key, value]),
    );
    expect(headers.get("X-Frame-Options")).toBe("SAMEORIGIN");
    expect(headers.get("Content-Security-Policy")).toBe(
      gameContentSecurityPolicy,
    );
    expect(headers.get("X-Content-Type-Options")).toBe("nosniff");
    expect(headers.get("Access-Control-Allow-Origin")).toBe("*");
  });
});
