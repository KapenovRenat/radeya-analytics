CREATE TABLE "kaspi_entries_sync_state" (
	"store_id" uuid PRIMARY KEY NOT NULL,
	"total_orders" integer DEFAULT 0,
	"orders_processed" integer DEFAULT 0,
	"entries_synced" integer DEFAULT 0,
	"status" text DEFAULT 'idle' NOT NULL,
	"last_error" text,
	"started_at" timestamp with time zone,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "kaspi_order_entries" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"order_id" uuid NOT NULL,
	"store_id" uuid NOT NULL,
	"entry_number" integer NOT NULL,
	"offer_code" text,
	"offer_name" text,
	"category_code" text,
	"category_title" text,
	"product_id" text,
	"quantity" integer DEFAULT 1 NOT NULL,
	"base_price" double precision DEFAULT 0,
	"total_price" double precision DEFAULT 0 NOT NULL,
	"delivery_cost" double precision DEFAULT 0,
	"synced_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "kaspi_entries_sync_state" ADD CONSTRAINT "kaspi_entries_sync_state_store_id_kaspi_stores_id_fk" FOREIGN KEY ("store_id") REFERENCES "public"."kaspi_stores"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "kaspi_order_entries" ADD CONSTRAINT "kaspi_order_entries_order_id_kaspi_orders_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."kaspi_orders"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "kaspi_order_entries" ADD CONSTRAINT "kaspi_order_entries_store_id_kaspi_stores_id_fk" FOREIGN KEY ("store_id") REFERENCES "public"."kaspi_stores"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "uq_entries_order_entryno" ON "kaspi_order_entries" USING btree ("order_id","entry_number");--> statement-breakpoint
CREATE INDEX "entries_store_offer_idx" ON "kaspi_order_entries" USING btree ("store_id","offer_code");--> statement-breakpoint
CREATE INDEX "entries_store_category_idx" ON "kaspi_order_entries" USING btree ("store_id","category_title");