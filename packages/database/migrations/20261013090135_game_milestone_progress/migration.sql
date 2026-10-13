CREATE TABLE "ador"."game_milestone_counters" (
	"user_id" uuid,
	"game_id" text,
	"milestone_id" text,
	"current" integer NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "game_milestone_counters_pkey" PRIMARY KEY("user_id","game_id","milestone_id"),
	CONSTRAINT "game_milestone_counter_bounded" CHECK ("current" between 0 and 1000000)
);
--> statement-breakpoint
ALTER TABLE "ador"."game_milestone_unlocks" ADD COLUMN "count" integer DEFAULT 1 NOT NULL;--> statement-breakpoint
ALTER TABLE "ador"."game_milestone_counters" ADD CONSTRAINT "game_milestone_counters_user_id_auth_users_id_fkey" FOREIGN KEY ("user_id") REFERENCES "ador"."auth_users"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "ador"."game_milestone_unlocks" ADD CONSTRAINT "game_milestone_count_bounded" CHECK ("count" between 1 and 1000000);