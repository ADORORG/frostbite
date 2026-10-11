import { describe, expect, it } from "vitest";

import {
  contentSecurityPolicy,
  cspReportPath,
  securityHeaders,
  type SecurityContext,
} from "../src/server/security/headers";

const context = (
  overrides: Partial<SecurityContext> = {},
): SecurityContext => ({
  development: false,
  nonce: "bm9uY2U=",
  platformIsHttps: true,
  security: {
    cspMode: "report-only",
    storageOrigin: "https://acct.r2.cloudflarestorage.com",
    trustedProxyHops: 1,
  },
  ...overrides,
});
const directive = (policy: string, name: string) =>
  policy.split("; ").find((part) => part.startsWith(`${name} `));

describe("the content security policy", () => {
  const policy = contentSecurityPolicy(context());

  it("runs scripts only with this response's nonce, and what such scripts load", () => {
    expect(directive(policy, "script-src")).toBe(
      "script-src 'self' 'nonce-bm9uY2U=' 'strict-dynamic'",
    );
    expect(policy).not.toContain("unsafe-eval");
  });

  it("allows script evaluation only in development", () => {
    expect(
      directive(
        contentSecurityPolicy(context({ development: true })),
        "script-src",
      ),
    ).toContain("'unsafe-eval'");
  });

  it("lets images and uploads go to the configured storage origin and nowhere else", () => {
    expect(directive(policy, "img-src")).toBe(
      "img-src 'self' data: blob: https://acct.r2.cloudflarestorage.com",
    );
    expect(directive(policy, "connect-src")).toBe(
      "connect-src 'self' https://acct.r2.cloudflarestorage.com",
    );
    const none = contentSecurityPolicy(
      context({
        security: {
          cspMode: "report-only",
          storageOrigin: null,
          trustedProxyHops: 1,
        },
      }),
    );
    expect(directive(none, "img-src")).toBe("img-src 'self' data: blob:");
    expect(directive(none, "connect-src")).toBe("connect-src 'self'");
  });

  it("allows no frames in or out, no plugins, and no other base or form target", () => {
    for (const expected of [
      "frame-ancestors 'none'",
      "frame-src 'none'",
      "object-src 'none'",
      "base-uri 'self'",
      "form-action 'self'",
      "default-src 'self'",
      "font-src 'self'",
    ])
      expect(policy.split("; ")).toContain(expected);
  });

  it("allows inline styles, the one relaxation, and reports violations to the platform", () => {
    expect(directive(policy, "style-src")).toBe(
      "style-src 'self' 'unsafe-inline'",
    );
    expect(directive(policy, "report-uri")).toBe(`report-uri ${cspReportPath}`);
  });

  it("upgrades insecure requests only on an HTTPS platform, so a local http run still works", () => {
    expect(policy.split("; ")).toContain("upgrade-insecure-requests");
    expect(
      contentSecurityPolicy(context({ platformIsHttps: false })),
    ).not.toContain("upgrade-insecure-requests");
  });
});

describe("the security headers", () => {
  const headers = (overrides: Partial<SecurityContext> = {}) =>
    new Map(securityHeaders(context(overrides)));

  it("sends the policy as report-only until the mode is enforce, then as the real policy", () => {
    const reporting = headers();
    expect(reporting.has("Content-Security-Policy-Report-Only")).toBe(true);
    expect(reporting.has("Content-Security-Policy")).toBe(false);
    const enforcing = headers({
      security: {
        cspMode: "enforce",
        storageOrigin: null,
        trustedProxyHops: 1,
      },
    });
    expect(enforcing.has("Content-Security-Policy")).toBe(true);
    expect(enforcing.has("Content-Security-Policy-Report-Only")).toBe(false);
  });

  it("always sends the browser-side protections", () => {
    const sent = headers();
    expect(sent.get("X-Content-Type-Options")).toBe("nosniff");
    expect(sent.get("X-Frame-Options")).toBe("DENY");
    expect(sent.get("Referrer-Policy")).toBe("strict-origin-when-cross-origin");
    expect(sent.get("Cross-Origin-Opener-Policy")).toBe(
      "same-origin-allow-popups",
    );
    expect(sent.get("Permissions-Policy")).toContain("camera=()");
    expect(sent.get("Permissions-Policy")).toContain("geolocation=()");
  });

  it("requires HTTPS for two years on an HTTPS platform and sends nothing of the kind on http", () => {
    expect(headers().get("Strict-Transport-Security")).toBe(
      "max-age=63072000; includeSubDomains",
    );
    expect(
      headers({ platformIsHttps: false }).has("Strict-Transport-Security"),
    ).toBe(false);
  });
});
