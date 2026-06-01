CREATE TABLE "product_reviews" (
	"id" text PRIMARY KEY NOT NULL,
	"product_id" text NOT NULL,
	"customer_name" text NOT NULL,
	"rating" integer NOT NULL,
	"text" text NOT NULL,
	"timestamp" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "sale_transactions" ADD COLUMN "status" text DEFAULT 'processing' NOT NULL;--> statement-breakpoint
ALTER TABLE "sale_transactions" ADD COLUMN "order_type" text;--> statement-breakpoint
ALTER TABLE "sale_transactions" ADD COLUMN "delivery_address" text;--> statement-breakpoint
ALTER TABLE "sale_transactions" ADD COLUMN "comment" text;--> statement-breakpoint
ALTER TABLE "product_reviews" ADD CONSTRAINT "product_reviews_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE cascade ON UPDATE no action;