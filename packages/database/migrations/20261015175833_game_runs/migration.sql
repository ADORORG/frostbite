CREATE TABLE "ador"."game_runs" (
	"id" uuid PRIMARY KEY,
	"user_id" uuid NOT NULL,
	"game_id" text NOT NULL,
	"verifier_digest" text NOT NULL,
	"seed" bigint NOT NULL,
	"state" text DEFAULT 'issued' NOT NULL,
	"issued_at" timestamp with time zone NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"submitted_at" timestamp with time zone,
	"verdict" text,
	"verdict_reason" text,
	"earned" jsonb,
	"record_digest" text,
	"record_text" text,
	CONSTRAINT "game_runs_state_known" CHECK ("state" in ('issued', 'submitted', 'expired')),
	CONSTRAINT "game_runs_seed_32_bits" CHECK ("seed" between 0 and 4294967295),
	CONSTRAINT "game_runs_expiry_after_issue" CHECK ("expires_at" > "issued_at"),
	CONSTRAINT "game_runs_verdict_known" CHECK ("verdict" is null or "verdict" in ('verified', 'rejected')),
	CONSTRAINT "game_runs_submitted_coherent" CHECK (("state" = 'submitted') = ("verdict" is not null) and ("state" = 'submitted') = ("submitted_at" is not null)),
	CONSTRAINT "game_runs_record_bounded" CHECK ("record_text" is null or char_length("record_text") <= 65536),
	CONSTRAINT "game_runs_digest_shape" CHECK ("verifier_digest" ~ '^[0-9a-f]{64}$' and ("record_digest" is null or "record_digest" ~ '^[0-9a-f]{64}$'))
);
--> statement-breakpoint
CREATE INDEX "game_runs_open_idx" ON "ador"."game_runs" ("user_id","game_id","state");--> statement-breakpoint
ALTER TABLE "ador"."game_runs" ADD CONSTRAINT "game_runs_user_id_auth_users_id_fkey" FOREIGN KEY ("user_id") REFERENCES "ador"."auth_users"("id") ON DELETE CASCADE;