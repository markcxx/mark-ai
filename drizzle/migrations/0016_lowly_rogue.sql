CREATE TABLE "model_usage_events" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"model_key" text NOT NULL,
	"tier" text NOT NULL,
	"credits" integer NOT NULL,
	"free" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "model_usage_events" ADD CONSTRAINT "model_usage_events_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "model_usage_events_user_created" ON "model_usage_events" USING btree ("user_id","created_at");