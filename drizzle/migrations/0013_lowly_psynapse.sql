CREATE TABLE "model_presentations" (
	"provider" text NOT NULL,
	"model_id" text NOT NULL,
	"display_name" text DEFAULT '' NOT NULL,
	"description" text DEFAULT '' NOT NULL,
	"is_new" boolean DEFAULT false NOT NULL,
	"new_until" timestamp with time zone,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"new_revision" text DEFAULT '' NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "model_presentations_provider_model_id_pk" PRIMARY KEY("provider","model_id")
);
