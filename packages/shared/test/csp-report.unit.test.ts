import { describe, expect, it } from "vitest";

import {
  cspReportMaxBytes,
  parseCspReport,
} from "../src/platform/csp-report.ts";

describe("a violation report", () => {
  it("is read from the older report-uri shape, preferring the effective directive", () => {
    expect(
      parseCspReport(
        JSON.stringify({
          "csp-report": {
            "blocked-uri": "https://evil.example.com/x.js",
            "document-uri": "https://platform.example.com/games",
            "effective-directive": "script-src-elem",
            "violated-directive": "script-src",
          },
        }),
      ),
    ).toEqual({
      blocked: "https://evil.example.com/x.js",
      directive: "script-src-elem",
      document: "https://platform.example.com/games",
    });
  });

  it("falls back to the violated directive, and to empty text for what is missing", () => {
    expect(
      parseCspReport(
        JSON.stringify({ "csp-report": { "violated-directive": "img-src" } }),
      ),
    ).toEqual({ blocked: "", directive: "img-src", document: "" });
    expect(parseCspReport(JSON.stringify({ "csp-report": {} }))).toEqual({
      blocked: "",
      directive: "",
      document: "",
    });
  });

  it("is read from the Reporting API shape, first report only", () => {
    expect(
      parseCspReport(
        JSON.stringify([
          {
            body: {
              blockedURL: "inline",
              documentURL: "https://p.example.com/",
              effectiveDirective: "script-src",
            },
          },
          { body: { blockedURL: "ignored" } },
        ]),
      ),
    ).toEqual({
      blocked: "inline",
      directive: "script-src",
      document: "https://p.example.com/",
    });
    expect(parseCspReport(JSON.stringify([{ body: {} }]))).toEqual({
      blocked: "",
      directive: "",
      document: "",
    });
  });

  it("keeps each field short, whatever the browser sent", () => {
    const long = "x".repeat(5_000);
    const report = parseCspReport(
      JSON.stringify({ "csp-report": { "blocked-uri": long } }),
    );
    expect(report?.blocked).toHaveLength(300);
  });

  it.each([
    ["text that is not JSON", "not json"],
    ["JSON that is not a report", JSON.stringify({ hello: "world" })],
    ["an empty list", "[]"],
    ["a number", "5"],
    [
      "a report whose fields are not text",
      JSON.stringify({ "csp-report": { "blocked-uri": 5 } }),
    ],
  ])("is nothing for %s", (_why, body) => {
    expect(parseCspReport(body)).toBeNull();
  });

  it("has a size limit that fits a real report with room to spare", () => {
    expect(cspReportMaxBytes).toBe(8_192);
  });
});
