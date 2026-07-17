ALTER TABLE "chat_messages" ADD COLUMN "active_variant_id" text;--> statement-breakpoint
ALTER TABLE "chat_messages" ADD COLUMN "variants" jsonb;