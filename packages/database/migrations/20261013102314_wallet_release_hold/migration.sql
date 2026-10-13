ALTER TYPE "ador"."auth_security_action" ADD VALUE 'wallet-linked';--> statement-breakpoint
ALTER TYPE "ador"."auth_security_action" ADD VALUE 'wallet-unlinked';--> statement-breakpoint
CREATE TABLE "ador"."released_wallets" (
	"id" uuid PRIMARY KEY,
	"network" text NOT NULL,
	"script_identity" text NOT NULL,
	"previous_user_id" uuid NOT NULL,
	"released_at" timestamp with time zone NOT NULL,
	"held_until" timestamp with time zone NOT NULL,
	CONSTRAINT "released_wallets_network_supported" CHECK ("network" in ('mainnet', 'signet')),
	CONSTRAINT "released_wallets_hold_after_release" CHECK ("held_until" > "released_at")
);
--> statement-breakpoint
CREATE UNIQUE INDEX "released_wallets_network_script_unique" ON "ador"."released_wallets" ("network","script_identity");--> statement-breakpoint
ALTER TABLE "ador"."released_wallets" ADD CONSTRAINT "released_wallets_previous_user_id_auth_users_id_fkey" FOREIGN KEY ("previous_user_id") REFERENCES "ador"."auth_users"("id") ON DELETE CASCADE;