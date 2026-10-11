import { z } from "zod";

// How many requests one subject (a person or a network address) may make to one thing in one window.
export const rateLimitPolicySchema = z
  .object({
    limit: z.number().int().min(1).max(100_000),
    windowMs: z.number().int().min(1_000).max(86_400_000),
  })
  .strict();
export type RateLimitPolicy = z.infer<typeof rateLimitPolicySchema>;

export interface RateLimitDecision {
  readonly allowed: boolean;
  readonly remaining: number;
  // Whole seconds until the current window ends (never less than 1): what `Retry-After` carries.
  readonly retryAfterSeconds: number;
}

export interface RateLimitRequest {
  // What is being limited ("createUploadIntent"), so one busy thing cannot use up another's allowance.
  readonly bucket: string;
  readonly now: Date;
  readonly policy: RateLimitPolicy;
  // Who is limited: "user:<id>" or "ip:<address>". Stores hash it; it is never written out as text.
  readonly subject: string;
}

export interface RateLimiter {
  // Counts one request and says whether it is within the limit. A request over the limit is still counted.
  consume(request: RateLimitRequest): Promise<RateLimitDecision>;
}

// The window a time falls in, as the time it started. Fixed windows: simple and cheap, and the worst case is
// twice the limit across a boundary, which is acceptable for protection against floods.
export function windowStart(now: Date, windowMs: number): number {
  return Math.floor(now.getTime() / windowMs) * windowMs;
}

export function decide(
  hits: number,
  request: Pick<RateLimitRequest, "now" | "policy">,
): RateLimitDecision {
  const end =
    windowStart(request.now, request.policy.windowMs) + request.policy.windowMs;
  return {
    allowed: hits <= request.policy.limit,
    remaining: Math.max(0, request.policy.limit - hits),
    // The window has not ended (`end` is after `now`), so this is at least 1.
    retryAfterSeconds: Math.ceil((end - request.now.getTime()) / 1_000),
  };
}

// The whole policy of a deployment: how much each kind of caller may do. Versioned so a change is a record.
export const rateLimitConfigSchema = z
  .object({
    // Everything from one network address, checked before any other work is done for the request.
    address: rateLimitPolicySchema,
    // What a request from a signed-out caller may do when its operation has no policy of its own.
    anonymous: rateLimitPolicySchema,
    // Operations that need their own, usually tighter, policy, by operation id.
    operations: z.record(
      z.string().regex(/^[a-z][A-Za-z0-9]*$/u),
      rateLimitPolicySchema,
    ),
    // What a signed-in person may do when the operation has no policy of its own.
    read: rateLimitPolicySchema,
    version: z.number().int().positive(),
    write: rateLimitPolicySchema,
  })
  .strict();
export type RateLimitConfig = z.infer<typeof rateLimitConfigSchema>;

export interface ResolvedRateLimit {
  readonly bucket: string;
  readonly policy: RateLimitPolicy;
}

// Which allowance applies to a request: the operation's own if it has one, otherwise the general one for the
// kind of caller and request. The bucket names what is counted, so one operation's traffic never uses up
// another's.
export function resolveRateLimit(
  config: RateLimitConfig,
  request: {
    readonly authenticated: boolean;
    readonly method: string;
    readonly operationId: string;
  },
): ResolvedRateLimit {
  const own = config.operations[request.operationId];
  if (own !== undefined) return { bucket: request.operationId, policy: own };
  if (!request.authenticated)
    return { bucket: "anonymous", policy: config.anonymous };
  return request.method === "GET"
    ? { bucket: "read", policy: config.read }
    : { bucket: "write", policy: config.write };
}
