import { createHash } from "node:crypto";

import {
  decide,
  windowStart,
  type RateLimitDecision,
  type RateLimitRequest,
} from "@frostbite/shared/http";
import { lt, sql } from "drizzle-orm";

import type { DatabaseClient } from "../connection/client.ts";
import { rateLimitWindows } from "../schema/rate-limit.ts";

// Windows older than this are removed. It is longer than any policy's window (the policy schema caps one at a
// day), so a row is never removed while it could still count.
const retentionMs = 2 * 86_400_000;

const hashSubject = (subject: string) =>
  createHash("sha256").update(subject).digest("hex");

// Counts requests in PostgreSQL so every web instance shares one count. One statement adds the request and
// returns the new total, so concurrent requests cannot miss each other. When a request starts a new window
// the table is also cleared of old ones, which keeps it small without a separate job.
export function createPostgresRateLimiter(
  database: Pick<DatabaseClient, "delete" | "insert">,
) {
  return {
    consume: async (request: RateLimitRequest): Promise<RateLimitDecision> => {
      const start = new Date(windowStart(request.now, request.policy.windowMs));
      const [row] = await database
        .insert(rateLimitWindows)
        .values({
          bucket: request.bucket,
          hits: 1,
          subjectHash: hashSubject(request.subject),
          windowStart: start,
        })
        .onConflictDoUpdate({
          set: { hits: sql`${rateLimitWindows.hits} + 1` },
          target: [
            rateLimitWindows.bucket,
            rateLimitWindows.subjectHash,
            rateLimitWindows.windowStart,
          ],
        })
        .returning({ hits: rateLimitWindows.hits });
      const hits = row?.hits ?? 1;
      if (hits === 1)
        await database
          .delete(rateLimitWindows)
          .where(
            lt(
              rateLimitWindows.windowStart,
              new Date(request.now.getTime() - retentionMs),
            ),
          );
      return decide(hits, request);
    },
  };
}
