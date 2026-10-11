import { NextRequest } from "next/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { config, proxy } from "../src/proxy";

beforeEach(() => {
  vi.stubEnv("APP_ENV", "production");
  vi.stubEnv("PUBLIC_BASE_URL", "https://platform.example.com");
  vi.stubEnv("NEXT_PUBLIC_APP_NAME", "Adorbitals");
  vi.stubEnv("R2_ENDPOINT", "https://acct.r2.cloudflarestorage.com");
  vi.stubEnv("SECURITY_CSP_MODE", "");
  vi.stubEnv("TRUSTED_PROXY_HOPS", "");
});
afterEach(() => {
  vi.unstubAllEnvs();
});

const nonceOf = (response: Response) =>
  /nonce-([^']+)/u.exec(
    response.headers.get("Content-Security-Policy-Report-Only") ?? "",
  )?.[1];

describe("the proxy", () => {
  it("gives every response its security headers, in report-only mode by default", () => {
    const response = proxy(
      new NextRequest("https://platform.example.com/games"),
    );
    expect(
      response.headers.get("Content-Security-Policy-Report-Only"),
    ).toContain("default-src 'self'");
    expect(response.headers.get("Content-Security-Policy")).toBeNull();
    expect(response.headers.get("X-Content-Type-Options")).toBe("nosniff");
    expect(response.headers.get("Strict-Transport-Security")).not.toBeNull();
  });

  it("enforces the policy when the deployment says so", () => {
    vi.stubEnv("SECURITY_CSP_MODE", "enforce");
    const response = proxy(
      new NextRequest("https://platform.example.com/games"),
    );
    expect(response.headers.get("Content-Security-Policy")).toContain(
      "script-src",
    );
    expect(
      response.headers.get("Content-Security-Policy-Report-Only"),
    ).toBeNull();
  });

  it("uses a new nonce for every request, and none is guessable from another", () => {
    const first = nonceOf(
      proxy(new NextRequest("https://platform.example.com/")),
    );
    const second = nonceOf(
      proxy(new NextRequest("https://platform.example.com/")),
    );
    expect(first).toBeDefined();
    expect(first).not.toBe(second);
  });

  it("hands the framework the same policy on the request, so it can put the nonce on its own scripts", () => {
    const response = proxy(new NextRequest("https://platform.example.com/"));
    const forwarded = response.headers.get(
      "x-middleware-request-content-security-policy",
    );
    expect(forwarded).toContain(`nonce-${nonceOf(response) ?? "missing"}`);
    expect(response.headers.get("x-middleware-request-x-nonce")).toBe(
      nonceOf(response),
    );
  });

  it("sends no HTTPS-only headers when the platform itself is plain http", () => {
    vi.stubEnv("PUBLIC_BASE_URL", "http://localhost:3000");
    const response = proxy(new NextRequest("http://localhost:3000/"));
    expect(response.headers.get("Strict-Transport-Security")).toBeNull();
    expect(
      response.headers.get("Content-Security-Policy-Report-Only"),
    ).not.toContain("upgrade-insecure-requests");
  });

  it("leaves out static files and prefetches", () => {
    const [matcher] = config.matcher;
    expect(matcher?.source).toContain("_next/static");
    expect(matcher?.missing?.map(({ key }) => key)).toEqual([
      "next-router-prefetch",
      "purpose",
    ]);
  });
});
