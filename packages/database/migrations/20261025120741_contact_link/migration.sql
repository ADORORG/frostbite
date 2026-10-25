ALTER TYPE "ador"."auth_security_action" ADD VALUE 'email-linked' BEFORE 'passkey-linked';--> statement-breakpoint
ALTER TYPE "ador"."auth_security_action" ADD VALUE 'email-unlinked' BEFORE 'passkey-linked';--> statement-breakpoint
ALTER TABLE "ador"."contact_codes" ADD COLUMN "purpose" text DEFAULT 'sign-in' NOT NULL;--> statement-breakpoint
ALTER TABLE "ador"."contact_codes" ADD COLUMN "user_id" uuid;--> statement-breakpoint
ALTER TABLE "ador"."contact_codes" ADD CONSTRAINT "contact_codes_user_id_auth_users_id_fkey" FOREIGN KEY ("user_id") REFERENCES "ador"."auth_users"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "ador"."contact_codes" ADD CONSTRAINT "contact_codes_purpose_consistent" CHECK (("purpose" = 'sign-in' and "user_id" is null) or ("purpose" = 'link' and "user_id" is not null));