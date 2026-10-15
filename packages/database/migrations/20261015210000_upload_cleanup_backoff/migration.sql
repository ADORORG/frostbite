ALTER TABLE "ador"."upload_intents" ADD COLUMN "cleanup_attempts" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "ador"."upload_intents" ADD COLUMN "cleanup_retry_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "ador"."upload_intents" ADD CONSTRAINT "upload_intents_cleanup_attempts_nonnegative" CHECK ("cleanup_attempts" >= 0);