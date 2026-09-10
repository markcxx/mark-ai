CREATE TABLE "site_announcements" (
	"id" text PRIMARY KEY NOT NULL,
	"content" text DEFAULT '' NOT NULL,
	"revision" text NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
