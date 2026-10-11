import { randomUUID } from "node:crypto";

import { createPostgresRateLimiter } from "@ador/database/rate-limit";
import { createRateLimitGate, type RateLimitGate } from "@ador/http/rate-limit";
import {
  correlationHeaderName,
  httpErrorEnvelopeSchema,
  type RateLimitDecision,
} from "@ador/shared/http";
import { parseSecurityEnvironment } from "@repo/config/env";

import { rateLimits } from "../../../../configs/rate-limits";
import { getDatabase } from "./database";

let gate: RateLimitGate | undefined;

// The process's rate limit gate: counts in the database, so every web instance shares one count, with the
// platform's policy and its number of trusted proxies.
export function getRateLimitGate(): RateLimitGate {
  gate ??= createRateLimitGate({
    config: rateLimits,
    // The database is reached only when a request is actually counted.
    limiter: {
      consume: (request) =>
        createPostgresRateLimiter(getDatabase()).consume(request),
    },
    now: () => new Date(),
    onError: (error) => console.error(`rate limiter: ${error.message}`),
    trustedProxyHops: parseSecurityEnvironment(process.env).trustedProxyHops,
  });
  return gate;
}

// The answer to a caller over a limit: the platform's error envelope, and how long to wait.
export function tooManyRequests(decision: RateLimitDecision): Response {
  const correlationId = randomUUID();
  return Response.json(
    httpErrorEnvelopeSchema.parse({
      error: {
        code: "rate_limited",
        correlationId,
        message: "Too many requests. Try again later.",
      },
    }),
    {
      headers: {
        [correlationHeaderName]: correlationId,
        "retry-after": String(decision.retryAfterSeconds),
      },
      status: 429,
    },
  );
}
