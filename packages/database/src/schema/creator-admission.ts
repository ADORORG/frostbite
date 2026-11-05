import {
  creatorAdmissionActions,
  creatorApplicationSchemaVersion,
  creatorApplicationStates,
  type CreatorApplicationDraft,
} from "@frostbite/shared/creator-admission";
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
import { platformSchema } from "./platform.ts";

export const creatorApplicationState = platformSchema.enum(
  "creator_application_state",
  creatorApplicationStates,
);
export const creatorAdmissionAction = platformSchema.enum(
  "creator_admission_action",
  creatorAdmissionActions,
);

export const creatorApplications = platformSchema.table(
  "creator_applications",
  {
    id: uuid("id").primaryKey(),
    applicantUserId: uuid("applicant_user_id")
      .notNull()
      .references(() => authUsers.id, { onDelete: "restrict" }),
    state: creatorApplicationState("state").notNull().default("draft"),
    draft: jsonb("draft").$type<CreatorApplicationDraft>().notNull(),
    revision: integer("revision").notNull().default(1),
    createdAt: timestamp("created_at", { mode: "date", withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { mode: "date", withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    uniqueIndex("creator_applications_applicant_unique").on(
      table.applicantUserId,
    ),
    index("creator_applications_state_updated_idx").on(
      table.state,
      table.updatedAt,
    ),
    check("creator_applications_revision_positive", sql`${table.revision} > 0`),
  ],
);

export const creatorApplicationSnapshots = platformSchema.table(
  "creator_application_snapshots",
  {
    id: uuid("id").primaryKey(),
    applicationId: uuid("application_id")
      .notNull()
      .references(() => creatorApplications.id, { onDelete: "restrict" }),
    submittedByUserId: uuid("submitted_by_user_id")
      .notNull()
      .references(() => authUsers.id, { onDelete: "restrict" }),
    sequence: integer("sequence").notNull(),
    schemaVersion: integer("schema_version").notNull(),
    verifiedContactEmail: text("verified_contact_email").notNull(),
    payload: jsonb("payload").$type<CreatorApplicationDraft>().notNull(),
    payloadHash: text("payload_hash").notNull(),
    createdAt: timestamp("created_at", { mode: "date", withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    uniqueIndex("creator_snapshots_application_sequence_unique").on(
      table.applicationId,
      table.sequence,
    ),
    check("creator_snapshots_sequence_positive", sql`${table.sequence} > 0`),
    check(
      "creator_snapshots_schema_version_supported",
      sql`${table.schemaVersion} = ${creatorApplicationSchemaVersion}`,
    ),
    check(
      "creator_snapshots_verified_email_nonempty",
      sql`length(${table.verifiedContactEmail}) > 0 and ${table.verifiedContactEmail} = btrim(${table.verifiedContactEmail})`,
    ),
    check(
      "creator_snapshots_hash_sha256",
      sql`${table.payloadHash} ~ '^[0-9a-f]{64}$'`,
    ),
  ],
);

export const creatorAdmissionEvents = platformSchema.table(
  "creator_admission_events",
  {
    id: uuid("id").primaryKey(),
    applicationId: uuid("application_id")
      .notNull()
      .references(() => creatorApplications.id, { onDelete: "restrict" }),
    snapshotId: uuid("snapshot_id").references(
      () => creatorApplicationSnapshots.id,
      { onDelete: "restrict" },
    ),
    actorUserId: uuid("actor_user_id")
      .notNull()
      .references(() => authUsers.id, { onDelete: "restrict" }),
    action: creatorAdmissionAction("action").notNull(),
    previousState: creatorApplicationState("previous_state").notNull(),
    nextState: creatorApplicationState("next_state").notNull(),
    reasonCode: text("reason_code").notNull(),
    creatorFeedback: text("creator_feedback").notNull().default(""),
    privateNotes: text("private_notes").notNull().default(""),
    evidenceReferences: jsonb("evidence_references")
      .$type<readonly string[]>()
      .notNull()
      .default([]),
    policyVersion: text("policy_version").notNull(),
    correlationId: uuid("correlation_id").notNull(),
    idempotencyKey: text("idempotency_key").notNull(),
    requestFingerprint: text("request_fingerprint").notNull(),
    createdAt: timestamp("created_at", { mode: "date", withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    uniqueIndex("creator_events_idempotency_unique").on(table.idempotencyKey),
    index("creator_events_application_created_idx").on(
      table.applicationId,
      table.createdAt,
    ),
    check(
      "creator_events_reason_code_valid",
      sql`${table.reasonCode} ~ '^[a-z][a-z0-9-]{2,63}$'`,
    ),
    check(
      "creator_events_policy_version_nonempty",
      sql`length(${table.policyVersion}) > 0 and ${table.policyVersion} = btrim(${table.policyVersion})`,
    ),
    check(
      "creator_events_request_fingerprint_sha256",
      sql`${table.requestFingerprint} ~ '^[0-9a-f]{64}$'`,
    ),
  ],
);

export type CreatorApplication = typeof creatorApplications.$inferSelect;
export type CreatorApplicationSnapshot =
  typeof creatorApplicationSnapshots.$inferSelect;
export type CreatorAdmissionEvent = typeof creatorAdmissionEvents.$inferSelect;
