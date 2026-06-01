ALTER TABLE "customers" ADD COLUMN "password_hash" text;--> statement-breakpoint
ALTER TABLE "products" ADD COLUMN "original_price_sell" integer;--> statement-breakpoint
ALTER TABLE "products" ADD COLUMN "is_promo" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "products" ADD COLUMN "promo_label" text;