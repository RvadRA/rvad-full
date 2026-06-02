CREATE TABLE IF NOT EXISTS "product_reviews" (
	"id" text PRIMARY KEY NOT NULL,
	"product_id" text NOT NULL,
	"customer_name" text NOT NULL,
	"rating" integer NOT NULL,
	"text" text NOT NULL,
	"timestamp" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "sale_transactions" ADD COLUMN IF NOT EXISTS "status" text DEFAULT 'processing' NOT NULL;--> statement-breakpoint
ALTER TABLE "sale_transactions" ADD COLUMN IF NOT EXISTS "order_type" text;--> statement-breakpoint
ALTER TABLE "sale_transactions" ADD COLUMN IF NOT EXISTS "delivery_address" text;--> statement-breakpoint
ALTER TABLE "sale_transactions" ADD COLUMN IF NOT EXISTS "comment" text;--> statement-breakpoint
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 
        FROM information_schema.table_constraints 
        WHERE constraint_name = 'product_reviews_product_id_products_id_fk' 
        AND table_name = 'product_reviews'
    ) THEN
        ALTER TABLE "product_reviews" 
        ADD CONSTRAINT "product_reviews_product_id_products_id_fk" 
        FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE cascade ON UPDATE no action;
    END IF;
END $$;