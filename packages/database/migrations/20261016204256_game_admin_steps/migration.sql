CREATE TABLE "ador"."game_admin_steps" (
	"id" uuid PRIMARY KEY,
	"game_id" text NOT NULL,
	"operation" text NOT NULL,
	"milestone_id" text,
	"created_by" uuid,
	"submitted_by" uuid,
	"chain" text NOT NULL,
	"contract_family" text NOT NULL,
	"contract_id" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"failure_reason" text,
	"signed_payload" text,
	"state" text NOT NULL,
	"summary" jsonb NOT NULL,
	"transaction_id" text,
	"unsigned_family" text NOT NULL,
	"unsigned_format" text NOT NULL,
	"unsigned_payload" text NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "game_admin_steps_operation_known" CHECK ("operation" in ('define-milestone', 'set-claims-paused')),
	CONSTRAINT "game_admin_steps_milestone_coherent" CHECK (("operation" = 'define-milestone') = ("milestone_id" is not null)),
	CONSTRAINT "game_admin_steps_state_known" CHECK ("state" in ('constructed', 'simulated', 'awaiting_signature', 'signed', 'broadcast_unknown', 'broadcast_accepted', 'broadcast_rejected', 'pending', 'confirmed', 'indexed_success', 'indexed_failure', 'reconciled', 'complete', 'expired')),
	CONSTRAINT "game_admin_steps_payload_bounded" CHECK (char_length("unsigned_payload") <= 65536 and ("signed_payload" is null or char_length("signed_payload") <= 65536)),
	CONSTRAINT "game_admin_steps_signed_coherent" CHECK (("state" in ('constructed', 'simulated', 'awaiting_signature', 'expired')) = ("signed_payload" is null)),
	CONSTRAINT "game_admin_steps_transaction_coherent" CHECK (("state" in ('constructed', 'simulated', 'awaiting_signature', 'signed', 'expired', 'broadcast_rejected')) = ("transaction_id" is null)),
	CONSTRAINT "game_admin_steps_failure_coherent" CHECK (("state" in ('broadcast_rejected', 'indexed_failure')) = ("failure_reason" is not null))
);
--> statement-breakpoint
CREATE INDEX "game_admin_steps_game_idx" ON "ador"."game_admin_steps" ("game_id","created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "game_admin_steps_one_in_progress_idx" ON "ador"."game_admin_steps" ("game_id","operation",coalesce("milestone_id", '')) WHERE "state" not in ('broadcast_rejected', 'complete', 'expired', 'indexed_failure');--> statement-breakpoint
ALTER TABLE "ador"."game_admin_steps" ADD CONSTRAINT "game_admin_steps_created_by_auth_users_id_fkey" FOREIGN KEY ("created_by") REFERENCES "ador"."auth_users"("id") ON DELETE SET NULL;--> statement-breakpoint
ALTER TABLE "ador"."game_admin_steps" ADD CONSTRAINT "game_admin_steps_submitted_by_auth_users_id_fkey" FOREIGN KEY ("submitted_by") REFERENCES "ador"."auth_users"("id") ON DELETE SET NULL;