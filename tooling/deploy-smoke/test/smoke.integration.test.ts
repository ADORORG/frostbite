import { afterEach, describe, expect, it } from "vitest";

import { runSmoke } from "../src/run-smoke.ts";
import {
  closeServers,
  healthy,
  safeHeaders,
  serve,
} from "./support/deployment.ts";
import { parseBaseUrl } from "../src/base-url.ts";

afterEach(closeServers);

const failures = async (base: URL, timeoutMs = 2000) =>
  (await runSmoke(base, { timeoutMs })).filter(({ ok }) => !ok);

describe("checking a deployment", () => {
  it("passes a healthy one, check by check, and does not follow the redirect it is checking for", async () => {
    const results = await runSmoke(await serve(healthy()), { timeoutMs: 2000 });
    expect(results.every(({ ok }) => ok)).toBe(true);
    expect(results).toHaveLength(7);
  });

  it("fails one that says it is not ready, and one whose answer is not the readiness shape", async () => {
    const notReady = await serve(
      healthy({
        "/api/ready": (_, response) => {
          response
            .writeHead(503, { "content-type": "application/json" })
            .end(JSON.stringify({ checks: [], status: "not-ready" }));
        },
      }),
    );
    expect((await failures(notReady)).map(({ detail }) => detail)).toEqual([
      "/api/ready answered 503.",
    ]);
    const lying = await serve(
      healthy({
        "/api/ready": (_, response) => {
          response
            .writeHead(200, { "content-type": "application/json" })
            .end(JSON.stringify({ checks: [], status: "not-ready" }));
        },
      }),
    );
    expect((await failures(lying))[0]?.detail).toBe(
      "/api/ready did not say ready.",
    );
    const odd = await serve(
      healthy({
        "/api/ready": (_, response) => {
          response.writeHead(200).end('{"status":"fine"}');
        },
      }),
    );
    expect((await failures(odd))[0]?.detail).toBe(
      "/api/ready did not say ready.",
    );
  });

  it("fails a page with no heading, and a landing page that is not served", async () => {
    const empty = await serve(
      healthy({
        "/": (_, response) => {
          response.writeHead(200, safeHeaders).end("<p>nothing</p>");
        },
      }),
    );
    expect((await failures(empty)).map(({ detail }) => detail)).toEqual([
      "/ has no heading.",
    ]);
    const down = await serve(
      healthy({
        "/": (_, response) => {
          response.writeHead(502).end();
        },
      }),
    );
    expect((await failures(down))[0]?.detail).toBe("/ answered 502.");
  });

  it("fails missing security headers, naming the one that is missing", async () => {
    const bare = await serve(
      healthy({
        "/": (_, response) => {
          response.writeHead(200).end("<h1>x</h1>");
        },
      }),
    );
    expect((await failures(bare))[0]?.detail).toBe(
      "/ has no x-content-type-options header.",
    );
    const noPolicy = await serve(
      healthy({
        "/": (_, response) => {
          response
            .writeHead(200, {
              "referrer-policy": "no-referrer",
              "x-content-type-options": "nosniff",
            })
            .end("<h1>x</h1>");
        },
      }),
    );
    expect((await failures(noPolicy))[0]?.detail).toBe(
      "/ has no content security policy.",
    );
    const reportOnly = await serve(
      healthy({
        "/": (_, response) => {
          response
            .writeHead(200, {
              "content-security-policy-report-only": "default-src 'self'",
              "referrer-policy": "no-referrer",
              "x-content-type-options": "nosniff",
            })
            .end("<h1>x</h1>");
        },
      }),
    );
    expect(await failures(reportOnly)).toEqual([]);
  });

  it("fails a platform contract of another version and a platform route that is down", async () => {
    const other = await serve(
      healthy({
        "/api/v1/platform": (_, response) => {
          response.writeHead(200).end('{"apiVersion":"v2"}');
        },
      }),
    );
    expect((await failures(other))[0]?.detail).toBe(
      "/api/v1/platform does not name apiVersion v1.",
    );
    const down = await serve(
      healthy({
        "/api/v1/platform": (_, response) => {
          response.writeHead(500).end();
        },
      }),
    );
    expect((await failures(down))[0]?.detail).toBe(
      "/api/v1/platform answered 500.",
    );
  });

  it("fails a private page that is open, and one that redirects somewhere other than sign-in", async () => {
    const open = await serve(
      healthy({
        "/studio": (_, response) => {
          response.writeHead(200).end("private");
        },
      }),
    );
    expect((await failures(open))[0]?.detail).toBe(
      "/studio answered 200, not a redirect.",
    );
    const elsewhere = await serve(
      healthy({
        "/studio": (_, response) => {
          response.writeHead(302, { location: "/" }).end();
        },
      }),
    );
    expect((await failures(elsewhere))[0]?.detail).toBe(
      "/studio did not send the visitor to sign in.",
    );
  });

  it("fails when the build did not ship the scene files, naming the command that makes them, or ships something that is not a png", async () => {
    const missing = await serve(
      healthy({
        "/scenes/pong.png": (_, response) => {
          response.writeHead(404).end();
        },
      }),
    );
    expect((await failures(missing))[0]?.detail).toContain(
      "was pnpm scenes:render run in the build?",
    );
    const wrong = await serve(
      healthy({
        "/scenes/pong.png": (_, response) => {
          response.writeHead(200, { "content-type": "text/html" }).end("x");
        },
      }),
    );
    expect((await failures(wrong))[0]?.detail).toBe(
      "/scenes/pong.png is not a png.",
    );
    const noType = await serve(
      healthy({
        "/scenes/pong.png": (_, response) => {
          response.writeHead(200).end("x");
        },
      }),
    );
    expect((await failures(noType))[0]?.detail).toBe(
      "/scenes/pong.png is not a png.",
    );
  });

  it("fails a games page that is down", async () => {
    const down = await serve(
      healthy({
        "/games": (_, response) => {
          response.writeHead(500).end();
        },
      }),
    );
    expect((await failures(down))[0]?.detail).toBe("/games answered 500.");
  });

  it("reports a request that never answers as a failed check, not a hung command", async () => {
    const hung = await serve(healthy({ "/games": () => undefined }));
    const failed = await failures(hung, 150);
    expect(failed).toHaveLength(1);
    expect(failed[0]?.name).toBe("serves the games it plays itself");
  });

  it("reports an unreachable deployment as every check failed, and says why in words", async () => {
    const base = await serve(healthy());
    await closeServers();
    const results = await runSmoke(base, { timeoutMs: 500 });
    expect(results.every(({ ok }) => !ok)).toBe(true);
    expect(results.every(({ detail }) => detail.length > 0)).toBe(true);
  });

  it("reports a thrown value that is not an error as a plain failure", async () => {
    const results = await runSmoke(parseBaseUrl("https://launch.example.org"), {
      checks: [{ name: "odd", run: () => Promise.reject("nope") }],
      timeoutMs: 100,
    });
    expect(results).toEqual([{ detail: "failed", name: "odd", ok: false }]);
  });
});
