import {
  uploadContentTypes,
  uploadPurposes,
  assetProcessingStates,
  assetRejectionReasons,
  type AssetRejectionReason,
  uploadFileNameMaxLength,
  type UploadContentType,
} from "@ador/shared/uploads";
import { sql } from "drizzle-orm";
import {
  bigint,
  check,
  index,
  integer,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";

import { assetValidationCoherence } from "./asset-validation-check.ts";
import { authUsers } from "./auth.ts";
import { platformSchema } from "./platform.ts";

// `abandoned` is set by cleanup once an intent was never completed and its cleanup time has passed;
// the private object is then removed, and `object_removed_at` records that it was.
export const uploadIntentStates = [
  "reserved",
  "completed",
  "cancelled",
  "failed",
  "abandoned",
] as const;
export const uploadIntentState = platformSchema.enum(
  "upload_intent_state",
  uploadIntentStates,
);
export const uploadPurpose = platformSchema.enum(
  "upload_purpose",
  uploadPurposes,
);
export const uploadContentType = platformSchema.enum(
  "upload_content_type",
  uploadContentTypes,
);
export const assetProcessingState = platformSchema.enum(
  "asset_processing_state",
  assetProcessingStates,
);

export const assetRejectionReason = platformSchema.enum(
  "asset_rejection_reason",
  assetRejectionReasons,
);

export const uploadIntents = platformSchema.table(
  "upload_intents",
  {
    id: uuid("id").primaryKey(),
    userId: uuid("user_id")
      .notNull()
      .references(() => authUsers.id, { onDelete: "restrict" }),
    purpose: uploadPurpose("purpose").notNull(),
    // The name on the creator's device, when they gave one; see uploadFileNameSchema.
    fileName: text("file_name"),
    contentType: uploadContentType("content_type")
      .$type<UploadContentType>()
      .notNull(),
    byteLength: bigint("byte_length", { mode: "number" }).notNull(),
    storageProviderId: text("storage_provider_id").notNull(),
    objectKey: text("object_key").notNull().unique(),
    state: uploadIntentState("state").notNull().default("reserved"),
    idempotencyKey: text("idempotency_key").notNull(),
    requestFingerprint: text("request_fingerprint").notNull(),
    expiresAt: timestamp("expires_at", {
      mode: "date",
      withTimezone: true,
    }).notNull(),
    cleanupEligibleAt: timestamp("cleanup_eligible_at", {
      mode: "date",
      withTimezone: true,
    }).notNull(),
    retainUntil: timestamp("retain_until", {
      mode: "date",
      withTimezone: true,
    }).notNull(),
    // How many times removing the object failed, and the earliest the next try may be: a key that always fails backs off
    // instead of taking a place in every pass.
    cleanupAttempts: integer("cleanup_attempts").notNull().default(0),
    cleanupRetryAt: timestamp("cleanup_retry_at", {
      mode: "date",
      withTimezone: true,
    }),
    objectRemovedAt: timestamp("object_removed_at", {
      mode: "date",
      withTimezone: true,
    }),
    createdAt: timestamp("created_at", { mode: "date", withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { mode: "date", withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    uniqueIndex("upload_intents_user_idempotency_unique").on(
      table.userId,
      table.idempotencyKey,
    ),
    index("upload_intents_active_user_idx").on(
      table.userId,
      table.state,
      table.expiresAt,
    ),
    // The cleanup sweep: intents not yet completed whose cleanup time has come, and abandoned ones
    // whose object removal has not been recorded.
    index("upload_intents_cleanup_idx")
      .on(table.cleanupEligibleAt)
      .where(
        sql`${table.state} in ('reserved', 'failed') or (${table.state} = 'abandoned' and ${table.objectRemovedAt} is null)`,
      ),
    check(
      "upload_intents_removal_requires_abandoned",
      sql`${table.objectRemovedAt} is null or ${table.state} = 'abandoned'`,
    ),
    check(
      "upload_intents_file_name_bare",
      sql`${table.fileName} is null or (length(${table.fileName}) between 1 and ${sql.raw(String(uploadFileNameMaxLength))} and ${table.fileName} !~ '[/\\\\[:cntrl:]]')`,
    ),
    check(
      "upload_intents_cleanup_attempts_nonnegative",
      sql`${table.cleanupAttempts} >= 0`,
    ),
    check("upload_intents_byte_length_positive", sql`${table.byteLength} > 0`),
    check(
      "upload_intents_storage_provider_nonempty",
      sql`length(btrim(${table.storageProviderId})) > 0`,
    ),
    check(
      "upload_intents_fingerprint_sha256",
      sql`${table.requestFingerprint} ~ '^[0-9a-f]{64}$'`,
    ),
    check(
      "upload_intents_cleanup_after_expiry",
      sql`${table.cleanupEligibleAt} > ${table.expiresAt}`,
    ),
    check(
      "upload_intents_retention_after_cleanup",
      sql`${table.retainUntil} > ${table.cleanupEligibleAt}`,
    ),
  ],
);

export const assets = platformSchema.table(
  "assets",
  {
    id: uuid("id").primaryKey(),
    uploadIntentId: uuid("upload_intent_id")
      .notNull()
      .references(() => uploadIntents.id, { onDelete: "restrict" }),
    userId: uuid("user_id")
      .notNull()
      .references(() => authUsers.id, { onDelete: "restrict" }),
    storageProviderId: text("storage_provider_id").notNull(),
    objectKey: text("object_key").notNull(),
    observedByteLength: bigint("observed_byte_length", {
      mode: "number",
    }).notNull(),
    observedContentType: text("observed_content_type").notNull(),
    observedEntityTag: text("observed_entity_tag").notNull(),
    observedLastModifiedAt: timestamp("observed_last_modified_at", {
      mode: "date",
      withTimezone: true,
    }).notNull(),
    processingState: assetProcessingState("processing_state")
      .notNull()
      .default("pending-validation"),
    // Validation outcome (W3-04): all null while pending; see assets_validation_coherent.
    validationCompletedAt: timestamp("validation_completed_at", {
      mode: "date",
      withTimezone: true,
    }),
    // Set when decoding finished (W3-05): the asset is `processed` or `unprocessable`.
    processingCompletedAt: timestamp("processing_completed_at", {
      mode: "date",
      withTimezone: true,
    }),
    validatorVersion: text("validator_version"),
    validatedEntityTag: text("validated_entity_tag"),
    contentSha256: text("content_sha256"),
    detectedContentType: uploadContentType(
      "detected_content_type",
    ).$type<UploadContentType>(),
    widthPixels: integer("width_pixels"),
    heightPixels: integer("height_pixels"),
    rejectionReason:
      assetRejectionReason("rejection_reason").$type<AssetRejectionReason>(),
    createdAt: timestamp("created_at", { mode: "date", withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { mode: "date", withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    uniqueIndex("assets_upload_intent_unique").on(table.uploadIntentId),
    index("assets_user_created_idx").on(table.userId, table.createdAt),
    check(
      "assets_observed_bytes_positive",
      sql`${table.observedByteLength} > 0`,
    ),
    check(
      "assets_storage_provider_nonempty",
      sql`length(btrim(${table.storageProviderId})) > 0`,
    ),
    check("assets_validation_coherent", assetValidationCoherence(table)),
    check("assets_object_key_nonempty", sql`length(${table.objectKey}) > 0`),
    check(
      "assets_content_type_nonempty",
      sql`length(btrim(${table.observedContentType})) > 0`,
    ),
    check(
      "assets_entity_tag_nonempty",
      sql`length(btrim(${table.observedEntityTag})) > 0`,
    ),
  ],
);

export type UploadIntent = typeof uploadIntents.$inferSelect;
export type Asset = typeof assets.$inferSelect;
