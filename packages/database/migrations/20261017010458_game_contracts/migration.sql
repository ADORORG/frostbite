CREATE TABLE "ador"."game_contracts" (
	"address" text NOT NULL,
	"chain" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"family" text NOT NULL,
	"game_id" text,
	"max_drawing_bytes" integer NOT NULL,
	"step_id" uuid NOT NULL,
	CONSTRAINT "game_contracts_pkey" PRIMARY KEY("game_id","chain"),
	CONSTRAINT "game_contracts_max_drawing_bytes_positive" CHECK ("max_drawing_bytes" > 0)
);
--> statement-breakpoint
CREATE TABLE "ador"."published_templates" (
	"address" text NOT NULL,
	"chain" text,
	"code_hash" text NOT NULL,
	"published_at" timestamp with time zone DEFAULT now() NOT NULL,
	"step_id" uuid NOT NULL,
	"template_ref" text,
	CONSTRAINT "published_templates_pkey" PRIMARY KEY("chain","template_ref"),
	CONSTRAINT "published_templates_code_hash_shape" CHECK ("code_hash" ~ '^[0-9a-f]{64}$')
);
--> statement-breakpoint
ALTER TABLE "ador"."game_admin_steps" ADD COLUMN "template_ref" text;--> statement-breakpoint
ALTER TABLE "ador"."game_admin_steps" ADD COLUMN "created_contracts" text[];--> statement-breakpoint
ALTER TABLE "ador"."game_admin_steps" ALTER COLUMN "game_id" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "ador"."game_admin_steps" ALTER COLUMN "contract_family" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "ador"."game_admin_steps" ALTER COLUMN "contract_id" DROP NOT NULL;--> statement-breakpoint
DROP INDEX "ador"."game_admin_steps_one_in_progress_idx";--> statement-breakpoint
CREATE UNIQUE INDEX "game_admin_steps_one_in_progress_idx" ON "ador"."game_admin_steps" (coalesce("game_id", ''),"operation",coalesce("milestone_id", ''),coalesce("template_ref", '')) WHERE "state" not in ('broadcast_rejected', 'complete', 'expired', 'indexed_failure');--> statement-breakpoint
CREATE UNIQUE INDEX "game_contracts_address_idx" ON "ador"."game_contracts" ("chain","address");--> statement-breakpoint
CREATE UNIQUE INDEX "published_templates_address_idx" ON "ador"."published_templates" ("chain","address");--> statement-breakpoint
ALTER TABLE "ador"."game_contracts" ADD CONSTRAINT "game_contracts_step_id_game_admin_steps_id_fkey" FOREIGN KEY ("step_id") REFERENCES "ador"."game_admin_steps"("id") ON DELETE RESTRICT;--> statement-breakpoint
ALTER TABLE "ador"."published_templates" ADD CONSTRAINT "published_templates_step_id_game_admin_steps_id_fkey" FOREIGN KEY ("step_id") REFERENCES "ador"."game_admin_steps"("id") ON DELETE RESTRICT;--> statement-breakpoint
ALTER TABLE "ador"."game_admin_steps" ADD CONSTRAINT "game_admin_steps_subject_coherent" CHECK (("operation" = 'publish-template') = ("template_ref" is not null) and ("operation" = 'publish-template') = ("game_id" is null));--> statement-breakpoint
ALTER TABLE "ador"."game_admin_steps" ADD CONSTRAINT "game_admin_steps_contract_coherent" CHECK (("contract_family" is null) = ("contract_id" is null) and ("operation" in ('define-milestone', 'set-claims-paused')) = ("contract_id" is not null));--> statement-breakpoint
ALTER TABLE "ador"."game_admin_steps" DROP CONSTRAINT "game_admin_steps_operation_known", ADD CONSTRAINT "game_admin_steps_operation_known" CHECK ("operation" in ('define-milestone', 'set-claims-paused', 'publish-template', 'deploy'));