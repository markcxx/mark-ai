ALTER TABLE "site_announcements" ADD COLUMN "enabled" boolean DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE "site_announcements" ADD COLUMN "closable" boolean DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE "site_announcements" ADD COLUMN "action_enabled" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "site_announcements" ADD COLUMN "action_label" text DEFAULT '了解更多' NOT NULL;--> statement-breakpoint
ALTER TABLE "site_announcements" ADD COLUMN "action_url" text DEFAULT '' NOT NULL;