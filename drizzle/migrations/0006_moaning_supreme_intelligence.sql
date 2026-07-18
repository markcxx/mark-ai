CREATE TABLE "admin_audit_logs" (
	"id" text PRIMARY KEY NOT NULL,
	"actor_user_id" text,
	"action" text NOT NULL,
	"target_type" text NOT NULL,
	"target_id" text,
	"metadata" jsonb,
	"ip_address" text,
	"user_agent" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "email_deliveries" (
	"id" text PRIMARY KEY NOT NULL,
	"event_type" text NOT NULL,
	"recipient" text NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"attempts" integer DEFAULT 0 NOT NULL,
	"dedupe_key" text NOT NULL,
	"last_error" text,
	"sent_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "waitlist_entries" (
	"id" text PRIMARY KEY NOT NULL,
	"email" text NOT NULL,
	"full_name" text,
	"message" text,
	"status" text DEFAULT 'pending' NOT NULL,
	"review_note" text,
	"reviewed_at" timestamp with time zone,
	"reviewed_by" text,
	"registered_user_id" text,
	"requested_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "waitlist_invitations" (
	"id" text PRIMARY KEY NOT NULL,
	"waitlist_entry_id" text NOT NULL,
	"token_hash" text NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"used_at" timestamp with time zone,
	"revoked_at" timestamp with time zone,
	"sent_at" timestamp with time zone,
	"created_by" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "admin_audit_logs" ADD CONSTRAINT "admin_audit_logs_actor_user_id_users_id_fk" FOREIGN KEY ("actor_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "waitlist_entries" ADD CONSTRAINT "waitlist_entries_reviewed_by_users_id_fk" FOREIGN KEY ("reviewed_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "waitlist_entries" ADD CONSTRAINT "waitlist_entries_registered_user_id_users_id_fk" FOREIGN KEY ("registered_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "waitlist_invitations" ADD CONSTRAINT "waitlist_invitations_waitlist_entry_id_waitlist_entries_id_fk" FOREIGN KEY ("waitlist_entry_id") REFERENCES "public"."waitlist_entries"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "waitlist_invitations" ADD CONSTRAINT "waitlist_invitations_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_admin_audit_logs_actor_created" ON "admin_audit_logs" USING btree ("actor_user_id","created_at");--> statement-breakpoint
CREATE INDEX "idx_admin_audit_logs_target" ON "admin_audit_logs" USING btree ("target_type","target_id");--> statement-breakpoint
CREATE UNIQUE INDEX "idx_email_deliveries_dedupe_key" ON "email_deliveries" USING btree ("dedupe_key");--> statement-breakpoint
CREATE INDEX "idx_email_deliveries_status_created" ON "email_deliveries" USING btree ("status","created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "idx_waitlist_entries_email" ON "waitlist_entries" USING btree ("email");--> statement-breakpoint
CREATE INDEX "idx_waitlist_entries_status_requested" ON "waitlist_entries" USING btree ("status","requested_at");--> statement-breakpoint
CREATE UNIQUE INDEX "idx_waitlist_invitations_token_hash" ON "waitlist_invitations" USING btree ("token_hash");--> statement-breakpoint
CREATE INDEX "idx_waitlist_invitations_entry" ON "waitlist_invitations" USING btree ("waitlist_entry_id","created_at");