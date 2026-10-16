CREATE TABLE "ador"."game_milestone_claims" (
	"id" uuid PRIMARY KEY,
	"user_id" uuid NOT NULL,
	"game_id" text NOT NULL,
	"milestone_id" text NOT NULL,
	"chain" text NOT NULL,
	"wallet_address" text NOT NULL,
	"contract_family" text NOT NULL,
	"contract_id" text NOT NULL,
	"expected_claims" integer NOT NULL,
	"state" text NOT NULL,
	"unsigned_family" text NOT NULL,
	"unsigned_format" text NOT NULL,
	"unsigned_payload" text NOT NULL,
	"summary" jsonb NOT NULL,
	"signed_payload" text,
	"transaction_id" text,
	"failure_reason" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	CONSTRAINT "game_milestone_claims_state_known" CHECK ("state" in ('constructed', 'simulated', 'awaiting_signature', 'signed', 'broadcast_unknown', 'broadcast_accepted', 'broadcast_rejected', 'pending', 'confirmed', 'indexed_success', 'indexed_failure', 'reconciled', 'complete', 'expired')),
	CONSTRAINT "game_milestone_claims_expected_positive" CHECK ("expected_claims" >= 1),
	CONSTRAINT "game_milestone_claims_payload_bounded" CHECK (char_length("unsigned_payload") <= 65536 and ("signed_payload" is null or char_length("signed_payload") <= 65536)),
	CONSTRAINT "game_milestone_claims_signed_coherent" CHECK (("state" in ('constructed', 'simulated', 'awaiting_signature', 'expired')) = ("signed_payload" is null)),
	CONSTRAINT "game_milestone_claims_transaction_coherent" CHECK (("state" in ('constructed', 'simulated', 'awaiting_signature', 'signed', 'expired', 'broadcast_rejected')) = ("transaction_id" is null)),
	CONSTRAINT "game_milestone_claims_failure_coherent" CHECK (("state" in ('broadcast_rejected', 'indexed_failure')) = ("failure_reason" is not null))
);
--> statement-breakpoint
CREATE INDEX "game_milestone_claims_player_idx" ON "ador"."game_milestone_claims" ("user_id","game_id");--> statement-breakpoint
CREATE UNIQUE INDEX "game_milestone_claims_one_in_progress_idx" ON "ador"."game_milestone_claims" ("user_id","game_id","milestone_id") WHERE "state" not in ('broadcast_rejected', 'complete', 'expired', 'indexed_failure');--> statement-breakpoint
ALTER TABLE "ador"."game_milestone_claims" ADD CONSTRAINT "game_milestone_claims_user_id_auth_users_id_fkey" FOREIGN KEY ("user_id") REFERENCES "ador"."auth_users"("id") ON DELETE CASCADE;