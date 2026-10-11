import {
  decide,
  resolveRateLimit,
  windowStart,
  type RateLimitConfig,
  type RateLimitDecision,
  type RateLimiter,
} from "@ador/shared/http";

// A limiter that keeps its counts in this process. Right for tests and a single instance; counts are lost on
// restart and are not shared between instances, which is why production uses the database one.
export function createMemoryRateLimiter(): RateLimiter {
  const windows = new Map<string, { hits: number; start: number }>();
  return {
    consume: async (request) => {
      const start = windowStart(request.now, request.policy.windowMs);
      const key = `${request.bucket}\u0000${request.subject}`;
      const current = windows.get(key);
      const hits = current?.start === start ? current.hits + 1 : 1;
      windows.set(key, { hits, start });
      // Windows that have passed are of no use; dropping them keeps the map from growing without end.
      for (const [other, value] of windows)
        if (value.start + request.policy.windowMs <= start)
          windows.delete(other);
      return decide(hits, request);
    },
  };
}

// The address of the client, read from `X-Forwarded-For` the given number of proxies from the end. Each trusted
// proxy appends the address it saw, so the entry `hops` from the end is the one the first trusted proxy
// recorded; anything before it is whatever the client claimed and is ignored. With no trusted proxy, or no
// header, there is no address to trust and the answer is null.
export function clientAddress(
  headers: Pick<Headers, "get">,
  trustedProxyHops: number,
): string | null {
  if (trustedProxyHops < 1) return null;
  const entries = (headers.get("x-forwarded-for") ?? "")
    .split(",")
    .map((entry) => entry.trim())
    .filter((entry) => entry !== "");
  const address = entries.at(-trustedProxyHops);
  return address === undefined ? null : address;
}

export interface RateLimitGate {
  // The first check, before the request is authenticated or its body read: everything from one address, and
  // for an operation open to anyone, that operation's own limit. Null when the request is within the limit or
  // there is no address to count it against.
  readonly byAddress: (input: {
    readonly headers: Pick<Headers, "get">;
    readonly method: string;
    readonly operationId: string;
    readonly publicOperation: boolean;
  }) => Promise<RateLimitDecision | null>;
  // The check after sign-in: what this person has done with this operation. Null when within the limit.
  readonly byPerson: (input: {
    readonly method: string;
    readonly operationId: string;
    readonly userId: string;
  }) => Promise<RateLimitDecision | null>;
}

// The two checks a request goes through. A limiter that fails does not stop the request: refusing everyone
// because the counter is down is worse than the flood it guards against, so a failure is reported through
// `onError` and the request goes ahead.
export function createRateLimitGate(dependencies: {
  readonly config: RateLimitConfig;
  readonly limiter: RateLimiter;
  readonly now: () => Date;
  readonly onError: (error: Error) => void;
  readonly trustedProxyHops: number;
}): RateLimitGate {
  const { config, limiter, now, onError, trustedProxyHops } = dependencies;
  async function count(
    request: Parameters<RateLimiter["consume"]>[0],
  ): Promise<RateLimitDecision | null> {
    try {
      const decision = await limiter.consume(request);
      return decision.allowed ? null : decision;
    } catch (error) {
      onError(
        error instanceof Error ? error : new Error("Rate limiter failed."),
      );
      return null;
    }
  }
  return {
    byAddress: async ({ headers, method, operationId, publicOperation }) => {
      const address = clientAddress(headers, trustedProxyHops);
      if (address === null) return null;
      const subject = `ip:${address}`;
      const general = await count({
        bucket: "address",
        now: now(),
        policy: config.address,
        subject,
      });
      if (general !== null || !publicOperation) return general;
      const own = resolveRateLimit(config, {
        authenticated: false,
        method,
        operationId,
      });
      return count({
        bucket: own.bucket,
        now: now(),
        policy: own.policy,
        subject,
      });
    },
    byPerson: ({ method, operationId, userId }) => {
      const own = resolveRateLimit(config, {
        authenticated: true,
        method,
        operationId,
      });
      return count({
        bucket: own.bucket,
        now: now(),
        policy: own.policy,
        subject: `user:${userId}`,
      });
    },
  };
}
