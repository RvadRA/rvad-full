CREATE TYPE "public"."user_role" AS ENUM('OWNER', 'ADMIN', 'CASHIER', 'WAREHOUSE');--> statement-breakpoint
CREATE TABLE "business_expenses" (
	"id" text PRIMARY KEY NOT NULL,
	"category" text NOT NULL,
	"amount" integer NOT NULL,
	"timestamp" timestamp with time zone DEFAULT now() NOT NULL,
	"date" text NOT NULL,
	"notes" text
);
--> statement-breakpoint
CREATE TABLE "categories" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"sku_prefix" text,
	CONSTRAINT "categories_name_unique" UNIQUE("name")
);
--> statement-breakpoint
CREATE TABLE "customers" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"phone" text NOT NULL,
	"telegram_chat_id" text,
	"debt" integer DEFAULT 0 NOT NULL,
	"debt_limit" integer DEFAULT 50000 NOT NULL,
	"discount_percent" integer DEFAULT 0 NOT NULL,
	"notes" text
);
--> statement-breakpoint
CREATE TABLE "debt_payments" (
	"id" text PRIMARY KEY NOT NULL,
	"customer_id" text NOT NULL,
	"customer_name" text NOT NULL,
	"amount" integer NOT NULL,
	"payment_method" text NOT NULL,
	"timestamp" timestamp with time zone DEFAULT now() NOT NULL,
	"synced" boolean DEFAULT true NOT NULL
);
--> statement-breakpoint
CREATE TABLE "employee_documents" (
	"id" text PRIMARY KEY NOT NULL,
	"employee_id" text NOT NULL,
	"type" text NOT NULL,
	"number" text NOT NULL,
	"issue_date" text NOT NULL,
	"expiry_date" text NOT NULL,
	"notes" text,
	"scans" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"monthly_payments" jsonb DEFAULT '[]'::jsonb NOT NULL
);
--> statement-breakpoint
CREATE TABLE "employees" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"role" "user_role" NOT NULL,
	"phone" text NOT NULL,
	"pin_hash" text NOT NULL,
	"telegram_chat_id" text,
	"is_online" boolean DEFAULT false NOT NULL,
	"status" text DEFAULT 'ACTIVE' NOT NULL,
	"join_date" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "products" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"barcode" text NOT NULL,
	"category" text NOT NULL,
	"sku" text NOT NULL,
	"image_url" text,
	"price_buy" integer NOT NULL,
	"price_sell" integer NOT NULL,
	"price_wholesale" integer,
	"stock" integer NOT NULL,
	"min_stock" integer DEFAULT 5 NOT NULL,
	"unit" text NOT NULL,
	"supplier_id" text,
	"responsible_employee_id" text,
	CONSTRAINT "products_barcode_unique" UNIQUE("barcode")
);
--> statement-breakpoint
CREATE TABLE "sale_transactions" (
	"id" text PRIMARY KEY NOT NULL,
	"timestamp" timestamp with time zone DEFAULT now() NOT NULL,
	"cashier_name" text NOT NULL,
	"items" jsonb NOT NULL,
	"total_price_buy" integer NOT NULL,
	"total_before_discount" integer NOT NULL,
	"total_discount" integer NOT NULL,
	"final_price" integer NOT NULL,
	"payment_method" text NOT NULL,
	"paid_cash" integer DEFAULT 0 NOT NULL,
	"paid_card" integer DEFAULT 0 NOT NULL,
	"paid_debt" integer DEFAULT 0 NOT NULL,
	"customer_id" text,
	"synced" boolean DEFAULT true NOT NULL
);
--> statement-breakpoint
CREATE TABLE "security_audit_logs" (
	"id" text PRIMARY KEY NOT NULL,
	"timestamp" timestamp with time zone DEFAULT now() NOT NULL,
	"role" "user_role" NOT NULL,
	"user_name" text NOT NULL,
	"action" text NOT NULL,
	"details" text NOT NULL,
	"severity" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "stock_correction_logs" (
	"id" text PRIMARY KEY NOT NULL,
	"product_id" text NOT NULL,
	"product_name" text NOT NULL,
	"old_stock" integer NOT NULL,
	"new_stock" integer NOT NULL,
	"type" text NOT NULL,
	"timestamp" timestamp with time zone DEFAULT now() NOT NULL,
	"notes" text,
	"cashier_name" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "suppliers" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"phone" text NOT NULL,
	"company" text NOT NULL,
	"debt" integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "sync_tasks" (
	"id" text PRIMARY KEY NOT NULL,
	"type" text NOT NULL,
	"payload" jsonb NOT NULL,
	"timestamp" timestamp with time zone DEFAULT now() NOT NULL,
	"status" text DEFAULT 'PENDING' NOT NULL
);
--> statement-breakpoint
ALTER TABLE "debt_payments" ADD CONSTRAINT "debt_payments_customer_id_customers_id_fk" FOREIGN KEY ("customer_id") REFERENCES "public"."customers"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "employee_documents" ADD CONSTRAINT "employee_documents_employee_id_employees_id_fk" FOREIGN KEY ("employee_id") REFERENCES "public"."employees"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "products" ADD CONSTRAINT "products_supplier_id_suppliers_id_fk" FOREIGN KEY ("supplier_id") REFERENCES "public"."suppliers"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "products" ADD CONSTRAINT "products_responsible_employee_id_employees_id_fk" FOREIGN KEY ("responsible_employee_id") REFERENCES "public"."employees"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sale_transactions" ADD CONSTRAINT "sale_transactions_customer_id_customers_id_fk" FOREIGN KEY ("customer_id") REFERENCES "public"."customers"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "stock_correction_logs" ADD CONSTRAINT "stock_correction_logs_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE cascade ON UPDATE no action;