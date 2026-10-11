import { parseEnvironment, parseSecurityEnvironment } from "@repo/config/env";
import { NextResponse, type NextRequest } from "next/server";

import {
  contentSecurityPolicy,
  securityHeaders,
  type SecurityContext,
} from "./server/security/headers";

// Runs before every page and API response (not static files) to give each response its security headers and
// a fresh nonce. The policy is also placed on the request, because that is where the framework finds the nonce
// to put on its own scripts; the response carries it under the configured mode (report-only or enforce).
export function proxy(request: NextRequest) {
  const environment = parseEnvironment(process.env);
  const context: SecurityContext = {
    development: process.env.NODE_ENV === "development",
    nonce: Buffer.from(crypto.randomUUID()).toString("base64"),
    platformIsHttps: environment.PUBLIC_BASE_URL.startsWith("https://"),
    security: parseSecurityEnvironment(process.env),
  };
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set("x-nonce", context.nonce);
  requestHeaders.set("Content-Security-Policy", contentSecurityPolicy(context));
  const response = NextResponse.next({ request: { headers: requestHeaders } });
  for (const [name, value] of securityHeaders(context))
    response.headers.set(name, value);
  return response;
}

export const config = {
  matcher: [
    {
      source: "/((?!_next/static|_next/image|favicon.ico).*)",
      missing: [
        { type: "header", key: "next-router-prefetch" },
        { type: "header", key: "purpose", value: "prefetch" },
      ],
    },
  ],
};
