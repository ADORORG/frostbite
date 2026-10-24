CREATE TYPE "ador"."platform_role_event_action" AS ENUM('granted', 'reinstated', 'suspended');--> statement-breakpoint
CREATE TYPE "ador"."platform_role_event_via" AS ENUM('role-screen', 'setup-link');--> statement-breakpoint
ALTER TYPE "ador"."platform_role" ADD VALUE 'admin';--> statement-breakpoint
CREATE TABLE "ador"."platform_role_events" (
	"id" uuid PRIMARY KEY,
	"action" "ador"."platform_role_event_action" NOT NULL,
	"actor_user_id" uuid NOT NULL,
	"target_user_id" uuid NOT NULL,
	"role" "ador"."platform_role" NOT NULL,
	"previous_status" "ador"."account_status",
	"next_status" "ador"."account_status" NOT NULL,
	"via" "ador"."platform_role_event_via" NOT NULL,
	"policy_version" text NOT NULL,
	"correlation_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "platform_role_events_policy_version_nonempty" CHECK (length("policy_version") > 0 and "policy_version" = btrim("policy_version"))
);
--> statement-breakpoint
CREATE INDEX "platform_role_events_target_created_idx" ON "ador"."platform_role_events" ("target_user_id","created_at");--> statement-breakpoint
ALTER TABLE "ador"."platform_role_events" ADD CONSTRAINT "platform_role_events_actor_user_id_auth_users_id_fkey" FOREIGN KEY ("actor_user_id") REFERENCES "ador"."auth_users"("id") ON DELETE RESTRICT;--> statement-breakpoint
ALTER TABLE "ador"."platform_role_events" ADD CONSTRAINT "platform_role_events_target_user_id_auth_users_id_fkey" FOREIGN KEY ("target_user_id") REFERENCES "ador"."auth_users"("id") ON DELETE RESTRICT;