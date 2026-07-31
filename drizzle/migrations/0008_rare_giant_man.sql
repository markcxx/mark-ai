CREATE TABLE "word_document_sources" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"session_id" text NOT NULL,
	"generated_file_id" text,
	"title" text NOT NULL,
	"revision" integer DEFAULT 0 NOT NULL,
	"state" jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "word_document_sources" ADD CONSTRAINT "word_document_sources_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "word_document_sources" ADD CONSTRAINT "word_document_sources_session_id_chat_sessions_id_fk" FOREIGN KEY ("session_id") REFERENCES "public"."chat_sessions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "word_document_sources" ADD CONSTRAINT "word_document_sources_generated_file_id_storage_files_id_fk" FOREIGN KEY ("generated_file_id") REFERENCES "public"."storage_files"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_word_document_sources_user_session_updated" ON "word_document_sources" USING btree ("user_id","session_id","updated_at");--> statement-breakpoint
CREATE INDEX "idx_word_document_sources_generated_file" ON "word_document_sources" USING btree ("generated_file_id");