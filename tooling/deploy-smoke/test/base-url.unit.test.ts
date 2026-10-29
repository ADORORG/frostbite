import { describe, expect, it } from "vitest";

import { parseBaseUrl } from "../src/base-url.ts";

describe("the address to check", () => {
  it("is an https origin", () => {
    expect(parseBaseUrl("https://launch.example.org").origin).toBe(
      "https://launch.example.org",
    );
    expect(parseBaseUrl("https://launch.example.org/").href).toBe(
      "https://launch.example.org/",
    );
  });

  it("may be plain http only on this machine", () => {
    for (const host of ["localhost:3000", "127.0.0.1:3000", "[::1]:3000"])
      expect(parseBaseUrl(`http://${host}`).protocol).toBe("http:");
    expect(() => parseBaseUrl("http://launch.example.org")).toThrow(
      "only localhost may use http",
    );
    expect(() => parseBaseUrl("ftp://localhost")).toThrow("https");
  });

  it.each([
    ["not an address", "is not an address"],
    ["https://user:secret@launch.example.org", "user name or password"],
    ["https://:secret@launch.example.org", "user name or password"],
    ["https://launch.example.org/studio", "origin only"],
    ["https://launch.example.org/?a=1", "origin only"],
    ["https://launch.example.org/#top", "origin only"],
  ])("refuses %s", (text, problem) => {
    expect(() => parseBaseUrl(text)).toThrow(problem);
  });
});
