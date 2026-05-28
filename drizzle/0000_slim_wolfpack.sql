CREATE TABLE "kaspi_orders" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"store_id" uuid NOT NULL,
	"order_code" text NOT NULL,
	"creation_date" timestamp with time zone NOT NULL,
	"total_price" double precision DEFAULT 0 NOT NULL,
	"delivery_cost_for_seller" double precision DEFAULT 0,
	"delivery_cost" double precision DEFAULT 0,
	"status" text NOT NULL,
	"state" text,
	"cancellation_reason" text,
	"payment_mode" text,
	"credit_term" integer,
	"delivery_mode" text,
	"is_kaspi_delivery" boolean DEFAULT false,
	"waybill_number" text,
	"is_express" boolean DEFAULT false,
	"assembled" boolean DEFAULT false,
	"approved_by_bank_date" timestamp with time zone,
	"customer_name" text,
	"customer_cell_phone" text,
	"delivery_address_city" text,
	"delivery_address_town" text,
	"delivery_address_formatted" text,
	"origin_address_city" text,
	"origin_address_formatted" text,
	"raw_data" jsonb,
	"synced_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "kaspi_stores" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"encrypted_token" text NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"last_sync_at" timestamp with time zone,
	"last_sync_status" text,
	"last_sync_error" text,
	"total_orders_count" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "kaspi_sync_state" (
	"store_id" uuid PRIMARY KEY NOT NULL,
	"current_chunk_start" timestamp with time zone,
	"current_chunk_end" timestamp with time zone,
	"overall_start" timestamp with time zone,
	"overall_end" timestamp with time zone,
	"total_chunks" integer DEFAULT 0,
	"chunks_done" integer DEFAULT 0,
	"orders_synced" integer DEFAULT 0,
	"status" text DEFAULT 'idle' NOT NULL,
	"last_error" text,
	"started_at" timestamp with time zone,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "kaspi_orders" ADD CONSTRAINT "kaspi_orders_store_id_kaspi_stores_id_fk" FOREIGN KEY ("store_id") REFERENCES "public"."kaspi_stores"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "kaspi_sync_state" ADD CONSTRAINT "kaspi_sync_state_store_id_kaspi_stores_id_fk" FOREIGN KEY ("store_id") REFERENCES "public"."kaspi_stores"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "uq_kaspi_orders_store_code" ON "kaspi_orders" USING btree ("store_id","order_code");--> statement-breakpoint
CREATE INDEX "kaspi_orders_store_date_idx" ON "kaspi_orders" USING btree ("store_id","creation_date");--> statement-breakpoint
CREATE INDEX "kaspi_orders_store_status_idx" ON "kaspi_orders" USING btree ("store_id","status");--> statement-breakpoint
CREATE INDEX "kaspi_orders_store_customer_idx" ON "kaspi_orders" USING btree ("store_id","customer_cell_phone");--> statement-breakpoint
CREATE INDEX "kaspi_orders_store_city_idx" ON "kaspi_orders" USING btree ("store_id","delivery_address_city");--> statement-breakpoint
CREATE INDEX "kaspi_orders_store_payment_idx" ON "kaspi_orders" USING btree ("store_id","payment_mode");--> statement-breakpoint
CREATE INDEX "kaspi_orders_store_delivery_idx" ON "kaspi_orders" USING btree ("store_id","delivery_mode");--> statement-breakpoint
CREATE INDEX "kaspi_stores_active_idx" ON "kaspi_stores" USING btree ("is_active");