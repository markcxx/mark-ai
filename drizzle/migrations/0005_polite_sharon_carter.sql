CREATE TABLE "session_enabled_tools" (
	"enabled_at" timestamp with time zone DEFAULT now() NOT NULL,
	"session_id" text NOT NULL,
	"tool_id" text NOT NULL,
	"user_id" text NOT NULL,
	CONSTRAINT "session_enabled_tools_session_id_tool_id_pk" PRIMARY KEY("session_id","tool_id")
);
--> statement-breakpoint
CREATE TABLE "user_installed_tools" (
	"installed_at" timestamp with time zone DEFAULT now() NOT NULL,
	"tool_id" text NOT NULL,
	"user_id" text NOT NULL,
	"version" text NOT NULL,
	CONSTRAINT "user_installed_tools_user_id_tool_id_pk" PRIMARY KEY("user_id","tool_id")
);
--> statement-breakpoint
ALTER TABLE "session_enabled_tools" ADD CONSTRAINT "session_enabled_tools_session_id_chat_sessions_id_fk" FOREIGN KEY ("session_id") REFERENCES "public"."chat_sessions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "session_enabled_tools" ADD CONSTRAINT "session_enabled_tools_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_installed_tools" ADD CONSTRAINT "user_installed_tools_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;