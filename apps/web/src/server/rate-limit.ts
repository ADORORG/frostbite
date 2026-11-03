import { createPostgresRateLimiter } from "@ador/database/rate-limit";
import { createRateLimitGate, type RateLimitGate } from "@ador/http/rate-limit";
import type { RateLimitDecision } from "@ador/shared/http";
import { parseSecurityEnvironment } from "@repo/config/env";

import { rateLimits } from "@repo/configs/rate-limits";
import { getDatabase } from "./database";
import { refusal } from "./http/refusal";

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
export const tooManyRequests = (decision: RateLimitDecision): Response =>
  refusal("rate_limited", "Too many requests. Try again later.", 429, {
    headers: { "retry-after": String(decision.retryAfterSeconds) },
  });
