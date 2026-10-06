CREATE TYPE "ador"."derivative_kind" AS ENUM('thumbnail', 'preview');--> statement-breakpoint
ALTER TYPE "ador"."asset_processing_state" ADD VALUE 'processed';--> statement-breakpoint
ALTER TYPE "ador"."asset_processing_state" ADD VALUE 'unprocessable';--> statement-breakpoint
ALTER TYPE "ador"."asset_rejection_reason" ADD VALUE 'decode-failed';--> statement-breakpoint
ALTER TYPE "ador"."asset_rejection_reason" ADD VALUE 'decoded-size-mismatch';--> statement-breakpoint
ALTER TYPE "ador"."asset_rejection_reason" ADD VALUE 'content-changed';--> statement-breakpoint
ALTER TYPE "ador"."asset_rejection_reason" ADD VALUE 'processing-limit-exceeded';--> statement-breakpoint
CREATE TABLE "ador"."asset_derivatives" (
	"id" uuid PRIMARY KEY,
	"asset_id" uuid NOT NULL,
	"kind" "ador"."derivative_kind" NOT NULL,
	"spec_version" text NOT NULL,
	"storage_provider_id" text NOT NULL,
	"object_key" text NOT NULL UNIQUE,
	"content_type" "ador"."upload_content_type" NOT NULL,
	"byte_length" bigint NOT NULL,
	"width_pixels" integer NOT NULL,
	"height_pixels" integer NOT NULL,
	"content_sha256" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "asset_derivatives_bytes_positive" CHECK ("byte_length" > 0),
	CONSTRAINT "asset_derivatives_dimensions_positive" CHECK ("width_pixels" > 0 AND "height_pixels" > 0),
	CONSTRAINT "asset_derivatives_hash_sha256" CHECK ("content_sha256" ~ '^[0-9a-f]{64}$'),
	CONSTRAINT "asset_derivatives_spec_nonempty" CHECK (length(btrim("spec_version")) > 0),
	CONSTRAINT "asset_derivatives_provider_nonempty" CHECK (length(btrim("storage_provider_id")) > 0)
);
--> statement-breakpoint
ALTER TABLE "ador"."assets" ADD COLUMN "processing_completed_at" timestamp with time zone;--> statement-breakpoint
CREATE UNIQUE INDEX "asset_derivatives_asset_kind_spec_unique" ON "ador"."asset_derivatives" ("asset_id","kind","spec_version");--> statement-breakpoint
ALTER TABLE "ador"."asset_derivatives" ADD CONSTRAINT "asset_derivatives_asset_id_assets_id_fkey" FOREIGN KEY ("asset_id") REFERENCES "ador"."assets"("id") ON DELETE RESTRICT;--> statement-breakpoint
ALTER TABLE "ador"."assets" DROP CONSTRAINT "assets_validation_coherent", ADD CONSTRAINT "assets_validation_coherent" CHECK ((
    "processing_state"::text = 'pending-validation'
    AND "validation_completed_at" IS NULL
    AND "validator_version" IS NULL
    AND "validated_entity_tag" IS NULL
    AND "content_sha256" IS NULL
    AND "detected_content_type" IS NULL
    AND "width_pixels" IS NULL
    AND "height_pixels" IS NULL
    AND "rejection_reason" IS NULL
    AND "processing_completed_at" IS NULL
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
    AND "processing_completed_at" IS NULL
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
    AND "processing_completed_at" IS NULL
  ) OR (
    "processing_state"::text = 'processed'
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
    AND "processing_completed_at" IS NOT NULL
  ) OR (
    "processing_state"::text = 'unprocessable'
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
    AND "rejection_reason" IS NOT NULL
    AND "processing_completed_at" IS NOT NULL
  ));