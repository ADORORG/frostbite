CREATE TABLE "ador"."game_milestone_unlocks" (
	"user_id" uuid,
	"game_id" text,
	"milestone_id" text,
	"unlocked_at" timestamp with time zone NOT NULL,
	"verification" text DEFAULT 'self-reported' NOT NULL,
	CONSTRAINT "game_milestone_unlocks_pkey" PRIMARY KEY("user_id","game_id","milestone_id"),
	CONSTRAINT "game_milestone_verification_known" CHECK ("verification" in ('self-reported'))
);
--> statement-breakpoint
CREATE TABLE "ador"."game_saves" (
	"user_id" uuid,
	"game_id" text,
	"progress" jsonb,
	"progress_bytes" integer DEFAULT 0 NOT NULL,
	"progress_saved_at" timestamp with time zone,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "game_saves_pkey" PRIMARY KEY("user_id","game_id"),
	CONSTRAINT "game_saves_progress_coherent" CHECK (("progress" is null) = ("progress_saved_at" is null)),
	CONSTRAINT "game_saves_bytes_bounded" CHECK ("progress_bytes" between 0 and 1048576)
);
--> statement-breakpoint
ALTER TABLE "ador"."game_milestone_unlocks" ADD CONSTRAINT "game_milestone_unlocks_user_id_auth_users_id_fkey" FOREIGN KEY ("user_id") REFERENCES "ador"."auth_users"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "ador"."game_saves" ADD CONSTRAINT "game_saves_user_id_auth_users_id_fkey" FOREIGN KEY ("user_id") REFERENCES "ador"."auth_users"("id") ON DELETE CASCADE;