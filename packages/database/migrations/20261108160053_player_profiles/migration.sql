CREATE TABLE "frostbite"."player_profiles" (
	"user_id" uuid PRIMARY KEY,
	"name" text NOT NULL,
	"name_key" text NOT NULL UNIQUE,
	"avatar" text NOT NULL,
	"visible" boolean NOT NULL,
	"name_changed_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone NOT NULL,
	"updated_at" timestamp with time zone NOT NULL,
	CONSTRAINT "player_profiles_name_key_is_lower" CHECK ("name_key" = lower("name")),
	CONSTRAINT "player_profiles_name_bounded" CHECK (char_length("name") between 1 and 32),
	CONSTRAINT "player_profiles_name_plain" CHECK ("name" ~ '^[A-Za-z0-9][A-Za-z0-9_-]*$'),
	CONSTRAINT "player_profiles_changed_after_created" CHECK ("name_changed_at" >= "created_at")
);
--> statement-breakpoint
ALTER TABLE "frostbite"."player_profiles" ADD CONSTRAINT "player_profiles_user_id_auth_users_id_fkey" FOREIGN KEY ("user_id") REFERENCES "frostbite"."auth_users"("id") ON DELETE CASCADE;