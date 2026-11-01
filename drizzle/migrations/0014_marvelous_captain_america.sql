CREATE TABLE "membership_plans" (
	"id" text PRIMARY KEY NOT NULL,
	"config" jsonb NOT NULL,
	"revision" text NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "user_memberships" (
	"user_id" text PRIMARY KEY NOT NULL,
	"tier" text DEFAULT 'free' NOT NULL,
	"expires_at" timestamp with time zone,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "user_memberships" ADD CONSTRAINT "user_memberships_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;