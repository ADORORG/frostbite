import { sql } from "drizzle-orm";
import {
  check,
  index,
  integer,
  primaryKey,
  text,
  timestamp,
} from "drizzle-orm/pg-core";

import { platformSchema } from "./platform.ts";

// Requests counted per thing, per subject, per time window, for the rate limiter. The subject is stored as a
// SHA-256 hash, never as the address or user id, so the table holds no personal data. A row is only ever a
// count; rows older than a day are removed as new windows begin.
export const rateLimitWindows = platformSchema.table(
  "rate_limit_windows",
  {
    bucket: text("bucket").notNull(),
    subjectHash: text("subject_hash").notNull(),
    windowStart: timestamp("window_start", {
      mode: "date",
      withTimezone: true,
    }).notNull(),
    hits: integer("hits").notNull(),
  },
  (table) => [
    primaryKey({
      columns: [table.bucket, table.subjectHash, table.windowStart],
    }),
    index("rate_limit_windows_start_idx").on(table.windowStart),
    check("rate_limit_hits_positive", sql`${table.hits} > 0`),
    check(
      "rate_limit_subject_hash_sha256",
      sql`${table.subjectHash} ~ '^[0-9a-f]{64}$'`,
    ),
    check(
      "rate_limit_bucket_bounded",
      sql`length(${table.bucket}) between 1 and 128`,
    ),
  ],
);
