import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const byAddress = vi.fn();
vi.mock("../src/server/rate-limit", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../src/server/rate-limit")>()),
  getRateLimitGate: () => ({ byAddress }),
}));

const { POST } = await import("../src/app/api/csp-report/route");
const { readCspReport } = await import("../src/server/security/csp-report");
const { tooManyRequests } = await import("../src/server/rate-limit");

const report = JSON.stringify({
  "csp-report": {
    "blocked-uri": "https://evil.example.com/x.js",
    "document-uri": "https://platform.example.com/games",
    "effective-directive": "script-src-elem",
  },
});
const post = (body: string, headers: Record<string, string> = {}) =>
  new Request("https://platform.example.com/api/csp-report", {
    body,
    headers: { "content-type": "application/csp-report", ...headers },
    method: "POST",
  });

let warn: ReturnType<typeof vi.spyOn>;
beforeEach(() => {
  byAddress.mockReset().mockResolvedValue(null);
  warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);
});
afterEach(() => {
  warn.mockRestore();
});

describe("reading a violation report from a request", () => {
  it("reads a report", async () => {
    expect(await readCspReport(post(report))).toEqual({
      blocked: "https://evil.example.com/x.js",
      directive: "script-src-elem",
      document: "https://platform.example.com/games",
    });
  });

  it("refuses a report that says it is too large, before reading it", async () => {
    const request = post(report, { "content-length": "9000" });
    const text = vi.spyOn(request, "text");
    expect(await readCspReport(request)).toBeNull();
    expect(text).not.toHaveBeenCalled();
  });

  it("refuses a body that is too large whatever it declared, and one that is empty or unreadable", async () => {
    expect(await readCspReport(post("x".repeat(9_000)))).toBeNull();
    expect(await readCspReport(post(""))).toBeNull();
    const broken = post(report);
    vi.spyOn(broken, "text").mockRejectedValue(new Error("aborted"));
    expect(await readCspReport(broken)).toBeNull();
  });
});

describe("the violation report endpoint", () => {
  it("logs a report and answers nothing, to a browser that does not read the answer", async () => {
    const response = await POST(post(report));
    expect(response.status).toBe(204);
    expect(await response.text()).toBe("");
    expect(warn).toHaveBeenCalledExactlyOnceWith(
      expect.stringContaining('"blocked":"https://evil.example.com/x.js"'),
    );
  });

  it("logs nothing for something that is not a report, and still answers the same", async () => {
    expect((await POST(post("not json"))).status).toBe(204);
    expect(warn).not.toHaveBeenCalled();
  });

  it("is limited by address like any open endpoint, and answers 429 with how long to wait", async () => {
    byAddress.mockResolvedValue({
      allowed: false,
      remaining: 0,
      retryAfterSeconds: 42,
    });
    const response = await POST(post(report));
    expect(response.status).toBe(429);
    expect(response.headers.get("retry-after")).toBe("42");
    expect(warn).not.toHaveBeenCalled();
    expect(byAddress).toHaveBeenCalledWith(
      expect.objectContaining({
        method: "POST",
        operationId: "cspReport",
        publicOperation: true,
      }),
    );
  });
});

describe("the too-many-requests answer", () => {
  it("is the platform's error envelope with a correlation id and the wait", async () => {
    const response = tooManyRequests({
      allowed: false,
      remaining: 0,
      retryAfterSeconds: 7,
    });
    const body = await response.json();
    expect([response.status, response.headers.get("retry-after")]).toEqual([
      429,
      "7",
    ]);
    expect(body.error).toMatchObject({
      code: "rate_limited",
      message: "Too many requests. Try again later.",
    });
    expect(response.headers.get("x-correlation-id")).toBe(
      body.error.correlationId,
    );
  });
});
