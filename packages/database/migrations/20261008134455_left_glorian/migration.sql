ALTER TYPE "ador"."upload_intent_state" ADD VALUE 'abandoned';--> statement-breakpoint
ALTER TABLE "ador"."upload_intents" ADD COLUMN "object_removed_at" timestamp with time zone;--> statement-breakpoint
CREATE INDEX "upload_intents_cleanup_idx" ON "ador"."upload_intents" ("cleanup_eligible_at") WHERE "state" in ('reserved', 'failed') or ("state" = 'abandoned' and "object_removed_at" is null);--> statement-breakpoint
ALTER TABLE "ador"."upload_intents" ADD CONSTRAINT "upload_intents_removal_requires_abandoned" CHECK ("object_removed_at" is null or "state" = 'abandoned');