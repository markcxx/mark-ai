CREATE TABLE "user_platforms" (
	"user_id" text NOT NULL,
	"platform" text NOT NULL,
	"app_version" text,
	"first_seen_at" timestamp with time zone DEFAULT now() NOT NULL,
	"last_seen_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "user_platforms_user_id_platform_pk" PRIMARY KEY("user_id","platform")
);
--> statement-breakpoint
ALTER TABLE "user_platforms" ADD CONSTRAINT "user_platforms_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_user_platforms_platform_user" ON "user_platforms" USING btree ("platform","user_id");
--> statement-breakpoint
-- Only recognizable browser sessions are classified as Web. Old Dart/native
-- clients have no reliable Android identity and remain unknown.
INSERT INTO "user_platforms" ("user_id", "platform", "first_seen_at", "last_seen_at")
SELECT "user_id",
  CASE WHEN "user_agent" ~ '^Mozilla/5[.]0\y' AND "user_agent" ~ '(Chrome|Firefox|Safari|Edg)/'
    THEN 'web' ELSE 'unknown' END,
  min("created_at"), max("updated_at")
FROM "auth_sessions"
GROUP BY "user_id", 2
ON CONFLICT ("user_id", "platform") DO NOTHING;
