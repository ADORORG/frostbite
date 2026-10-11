import {
  liveSubmissionStates,
  submissionActions,
  submissionSchemaVersion,
  submissionStates,
  type SubmissionSnapshot,
} from "@ador/shared/collections";
import { sql } from "drizzle-orm";
import {
  check,
  index,
  integer,
  jsonb,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";

import { authUsers } from "./auth.ts";
import { collections } from "./collections.ts";
import { platformSchema } from "./platform.ts";

export const submissionState = platformSchema.enum(
  "collection_submission_state",
  submissionStates,
);
export const submissionAction = platformSchema.enum(
  "collection_submission_action",
  submissionActions,
);

const stateList = (states: readonly string[]) =>
  sql.raw(states.map((state) => `'${state}'`).join(", "));

// One frozen, reviewable copy of a collection. Everything except `state` and `updated_at` is written
// once and can never change: a database trigger refuses any other update and every delete, so the
// reviewed snapshot cannot be altered by editing the draft, by a bug, or by a stray query.
export const collectionSubmissions = platformSchema.table(
  "collection_submissions",
  {
    id: uuid("id").primaryKey(),
    collectionId: uuid("collection_id")
      .notNull()
      .references(() => collections.id, { onDelete: "restrict" }),
    // The creator at submission time. Kept on the submission so review never has to trust the
    // mutable draft row for who owns it.
    ownerUserId: uuid("owner_user_id")
      .notNull()
      .references(() => authUsers.id, { onDelete: "restrict" }),
    sequence: integer("sequence").notNull(),
    // The draft revision that was frozen: the creator's last saved view.
    collectionRevision: integer("collection_revision").notNull(),
    schemaVersion: integer("schema_version").notNull(),
    snapshot: jsonb("snapshot").$type<SubmissionSnapshot>().notNull(),
    payloadHash: text("payload_hash").notNull(),
    state: submissionState("state").notNull().default("submitted"),
    createdAt: timestamp("created_at", { mode: "date", withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { mode: "date", withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    uniqueIndex("collection_submissions_collection_sequence_unique").on(
      table.collectionId,
      table.sequence,
    ),
    // At most one submission of a collection is live at a time.
    uniqueIndex("collection_submissions_one_live_per_collection")
      .on(table.collectionId)
      .where(sql`${table.state} in (${stateList(liveSubmissionStates)})`),
    index("collection_submissions_state_updated_idx").on(
      table.state,
      table.updatedAt,
    ),
    check(
      "collection_submissions_sequence_positive",
      sql`${table.sequence} > 0`,
    ),
    check(
      "collection_submissions_revision_positive",
      sql`${table.collectionRevision} > 0`,
    ),
    check(
      "collection_submissions_schema_version_supported",
      sql`${table.schemaVersion} = ${sql.raw(String(submissionSchemaVersion))}`,
    ),
    check(
      "collection_submissions_hash_sha256",
      sql`${table.payloadHash} ~ '^[0-9a-f]{64}$'`,
    ),
  ],
);

// The append-only record of every submission and decision. A trigger refuses updates and deletes.
export const collectionReviewEvents = platformSchema.table(
  "collection_review_events",
  {
    id: uuid("id").primaryKey(),
    submissionId: uuid("submission_id")
      .notNull()
      .references(() => collectionSubmissions.id, { onDelete: "restrict" }),
    actorUserId: uuid("actor_user_id")
      .notNull()
      .references(() => authUsers.id, { onDelete: "restrict" }),
    action: submissionAction("action").notNull(),
    // Null only for the `submit` event, which creates the submission.
    previousState: submissionState("previous_state"),
    nextState: submissionState("next_state").notNull(),
    reasonCode: text("reason_code").notNull(),
    creatorFeedback: text("creator_feedback").notNull().default(""),
    privateNotes: text("private_notes").notNull().default(""),
    policyVersion: text("policy_version").notNull(),
    correlationId: uuid("correlation_id").notNull(),
    idempotencyKey: text("idempotency_key").notNull(),
    requestFingerprint: text("request_fingerprint").notNull(),
    createdAt: timestamp("created_at", { mode: "date", withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    uniqueIndex("collection_review_events_idempotency_unique").on(
      table.idempotencyKey,
    ),
    index("collection_review_events_submission_created_idx").on(
      table.submissionId,
      table.createdAt,
    ),
    check(
      "collection_review_events_reason_code_valid",
      sql`${table.reasonCode} ~ '^[a-z][a-z0-9-]{2,63}$'`,
    ),
    // Not pinned to the current policy version: each event keeps the version it was decided under.
    check(
      "collection_review_events_policy_version_nonempty",
      sql`length(${table.policyVersion}) > 0 and ${table.policyVersion} = btrim(${table.policyVersion})`,
    ),
    check(
      "collection_review_events_fingerprint_sha256",
      sql`${table.requestFingerprint} ~ '^[0-9a-f]{64}$'`,
    ),
    check(
      "collection_review_events_previous_state_coherent",
      sql`(${table.action} = 'submit') = (${table.previousState} is null)`,
    ),
  ],
);

export type CollectionSubmissionRow = typeof collectionSubmissions.$inferSelect;
export type CollectionReviewEventRow =
  typeof collectionReviewEvents.$inferSelect;
