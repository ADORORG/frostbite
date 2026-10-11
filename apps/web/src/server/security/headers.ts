import type { SecurityEnvironment } from "@repo/config/env";

export const cspReportPath = "/api/csp-report";

export interface SecurityContext {
  // Local development needs script evaluation for React's debugging; production does not.
  readonly development: boolean;
  readonly nonce: string;
  readonly platformIsHttps: boolean;
  readonly security: SecurityEnvironment;
}

// The Content Security Policy for a page. Scripts run only with this response's nonce (and what those scripts load),
// so an injected script cannot run. Styles allow inline text because the UI sets some style attributes; that is a
// known, lower risk and is the one relaxation. Images and uploads may go to the storage origin the platform is
// configured with, nowhere else. No page may be framed, and the only frames a page may hold are the platform's own game files (which carry a sandbox of their own); no plugins.
export function contentSecurityPolicy(context: SecurityContext): string {
  const { development, nonce, platformIsHttps, security } = context;
  const storage =
    security.storageOrigin === null ? [] : [security.storageOrigin];
  const directives: Record<string, readonly string[]> = {
    "base-uri": ["'self'"],
    "connect-src": ["'self'", ...storage],
    "default-src": ["'self'"],
    "font-src": ["'self'"],
    "form-action": ["'self'"],
    "frame-ancestors": ["'none'"],
    "frame-src": ["'self'"],
    "img-src": ["'self'", "data:", "blob:", ...storage],
    "object-src": ["'none'"],
    "report-uri": [cspReportPath],
    "script-src": [
      "'self'",
      `'nonce-${nonce}'`,
      "'strict-dynamic'",
      ...(development ? ["'unsafe-eval'"] : []),
    ],
    "style-src": ["'self'", "'unsafe-inline'"],
  };
  const parts = Object.entries(directives).map(
    ([name, sources]) => `${name} ${sources.join(" ")}`,
  );
  // Asking the browser to upgrade http requests would break a plain-http local run.
  if (platformIsHttps) parts.push("upgrade-insecure-requests");
  return parts.join("; ");
}

// Every security header for a response. The policy goes out under the name for the configured mode, so
// `report-only` reports what it would block and blocks nothing.
export function securityHeaders(context: SecurityContext): [string, string][] {
  const policy = contentSecurityPolicy(context);
  return [
    [
      context.security.cspMode === "enforce"
        ? "Content-Security-Policy"
        : "Content-Security-Policy-Report-Only",
      policy,
    ],
    ["X-Content-Type-Options", "nosniff"],
    ["X-Frame-Options", "DENY"],
    ["Referrer-Policy", "strict-origin-when-cross-origin"],
    // Wallet sign-in opens a window of its own and needs to hear back from it.
    ["Cross-Origin-Opener-Policy", "same-origin-allow-popups"],
    [
      "Permissions-Policy",
      "camera=(), microphone=(), geolocation=(), payment=(), usb=(), serial=(), bluetooth=()",
    ],
    // Over HTTPS only: the header means nothing on http and must not stick to a local hostname.
    ...(context.platformIsHttps
      ? ([
          ["Strict-Transport-Security", "max-age=63072000; includeSubDomains"],
        ] as [string, string][])
      : []),
  ];
}
