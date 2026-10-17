ALTER TABLE "ador"."game_admin_steps" ADD COLUMN "broadcast_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "ador"."game_milestone_claims" ADD COLUMN "broadcast_at" timestamp with time zone;--> statement-breakpoint
-- Rows sent before the time was kept: the last change is the nearest time known (a delayed wait is counted from it, and is never wrongly called failed).
UPDATE "ador"."game_admin_steps" SET "broadcast_at" = "updated_at" WHERE "transaction_id" IS NOT NULL;--> statement-breakpoint
UPDATE "ador"."game_milestone_claims" SET "broadcast_at" = "updated_at" WHERE "transaction_id" IS NOT NULL;--> statement-breakpoint
ALTER TABLE "ador"."game_admin_steps" ADD CONSTRAINT "game_admin_steps_broadcast_coherent" CHECK (("transaction_id" is null) = ("broadcast_at" is null));--> statement-breakpoint
ALTER TABLE "ador"."game_milestone_claims" ADD CONSTRAINT "game_milestone_claims_broadcast_coherent" CHECK (("transaction_id" is null) = ("broadcast_at" is null));
