CREATE TYPE "ador"."asset_rejection_reason" AS ENUM('unsupported-format', 'media-type-mismatch', 'size-exceeded', 'byte-length-mismatch', 'malformed', 'animation-unsupported', 'dimensions-exceeded', 'pixels-exceeded');--> statement-breakpoint
ALTER TYPE "ador"."asset_processing_state" ADD VALUE 'validated';--> statement-breakpoint
ALTER TYPE "ador"."asset_processing_state" ADD VALUE 'rejected';--> statement-breakpoint
ALTER TABLE "ador"."assets" ADD COLUMN "validation_completed_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "ador"."assets" ADD COLUMN "validator_version" text;--> statement-breakpoint
ALTER TABLE "ador"."assets" ADD COLUMN "validated_entity_tag" text;--> statement-breakpoint
ALTER TABLE "ador"."assets" ADD COLUMN "content_sha256" text;--> statement-breakpoint
ALTER TABLE "ador"."assets" ADD COLUMN "detected_content_type" "ador"."upload_content_type";--> statement-breakpoint
ALTER TABLE "ador"."assets" ADD COLUMN "width_pixels" integer;--> statement-breakpoint
ALTER TABLE "ador"."assets" ADD COLUMN "height_pixels" integer;--> statement-breakpoint
ALTER TABLE "ador"."assets" ADD COLUMN "rejection_reason" "ador"."asset_rejection_reason";--> statement-breakpoint
ALTER TABLE "ador"."assets" ADD CONSTRAINT "assets_validation_coherent" CHECK ((
        "processing_state"::text = 'pending-validation'
        AND "validation_completed_at" IS NULL
        AND "validator_version" IS NULL
        AND "validated_entity_tag" IS NULL
        AND "content_sha256" IS NULL
        AND "detected_content_type" IS NULL
        AND "width_pixels" IS NULL
        AND "height_pixels" IS NULL
        AND "rejection_reason" IS NULL
      ) OR (
        "processing_state"::text = 'validated'
        AND "validation_completed_at" IS NOT NULL
        AND "validator_version" IS NOT NULL
        AND length(btrim("validator_version")) > 0
        AND "validated_entity_tag" IS NOT NULL
        AND length(btrim("validated_entity_tag")) > 0
        AND "content_sha256" IS NOT NULL
        AND "content_sha256" ~ '^[0-9a-f]{64}$'
        AND "detected_content_type" IS NOT NULL
        AND "width_pixels" IS NOT NULL
        AND "width_pixels" > 0
        AND "height_pixels" IS NOT NULL
        AND "height_pixels" > 0
        AND "rejection_reason" IS NULL
      ) OR (
        "processing_state"::text = 'rejected'
        AND "validation_completed_at" IS NOT NULL
        AND "validator_version" IS NOT NULL
        AND length(btrim("validator_version")) > 0
        AND "rejection_reason" IS NOT NULL
        AND "validated_entity_tag" IS NULL
        AND "content_sha256" IS NULL
        AND "detected_content_type" IS NULL
        AND "width_pixels" IS NULL
        AND "height_pixels" IS NULL
      ));