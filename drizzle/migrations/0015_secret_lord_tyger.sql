CREATE TABLE "payment_orders" (
	"id" text PRIMARY KEY NOT NULL,
	"order_number" text NOT NULL,
	"user_id" text NOT NULL,
	"tier" text NOT NULL,
	"months" integer DEFAULT 1 NOT NULL,
	"amount_cents" integer NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"provider" text NOT NULL,
	"provider_order_number" text NOT NULL,
	"provider_transaction_id" text,
	"payment_method" text NOT NULL,
	"merchant_id" text NOT NULL,
	"last_checked_at" timestamp with time zone,
	"membership_expires_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"paid_at" timestamp with time zone,
	CONSTRAINT "payment_orders_order_number_unique" UNIQUE("order_number"),
	CONSTRAINT "payment_orders_provider_transaction_id_unique" UNIQUE("provider_transaction_id")
);
--> statement-breakpoint
ALTER TABLE "payment_orders" ADD CONSTRAINT "payment_orders_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "payment_orders_provider_number" ON "payment_orders" USING btree ("provider","provider_order_number");--> statement-breakpoint
CREATE INDEX "payment_orders_user_created" ON "payment_orders" USING btree ("user_id","created_at");