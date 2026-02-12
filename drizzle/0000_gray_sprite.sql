CREATE EXTENSION IF NOT EXISTS vector;
--> statement-breakpoint
CREATE TABLE "tenant_settings" (
	"organization_id" text PRIMARY KEY NOT NULL,
	"llm_provider" text DEFAULT 'claude' NOT NULL,
	"llm_api_key_encrypted" text,
	"confidence_threshold" real DEFAULT 0.7 NOT NULL,
	"auto_learn_enabled" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "customers" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" text NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"settings" jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "knowledge_entries" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" text NOT NULL,
	"customer_id" uuid NOT NULL,
	"type" text NOT NULL,
	"title" text NOT NULL,
	"content" text NOT NULL,
	"embedding" vector(1536),
	"metadata" jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "rfps" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" text NOT NULL,
	"customer_id" uuid NOT NULL,
	"assigned_user_id" text NOT NULL,
	"name" text NOT NULL,
	"status" text DEFAULT 'draft' NOT NULL,
	"customer_company_name" text,
	"customer_contact_name" text,
	"customer_contact_info" jsonb,
	"receive_date" date,
	"due_date" date,
	"completion_date" date,
	"original_file_url" text,
	"original_file_type" text,
	"completed_file_url" text,
	"automation_percentage" real DEFAULT 0,
	"version" integer DEFAULT 1 NOT NULL,
	"parsed_structure" jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "rfp_responses" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"rfp_id" uuid NOT NULL,
	"field_id" text NOT NULL,
	"field_type" text NOT NULL,
	"question" text NOT NULL,
	"response_text" text,
	"confidence_score" real,
	"status" text DEFAULT 'needs_input' NOT NULL,
	"position" jsonb,
	"ai_metadata" jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "rfp_versions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"rfp_id" uuid NOT NULL,
	"version_number" integer NOT NULL,
	"created_by" text NOT NULL,
	"snapshot" jsonb,
	"change_summary" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "learnings" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" text NOT NULL,
	"customer_id" uuid,
	"content" text NOT NULL,
	"source_type" text NOT NULL,
	"created_by" text NOT NULL,
	"source_metadata" jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "knowledge_entries" ADD CONSTRAINT "knowledge_entries_customer_id_customers_id_fk" FOREIGN KEY ("customer_id") REFERENCES "public"."customers"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "rfps" ADD CONSTRAINT "rfps_customer_id_customers_id_fk" FOREIGN KEY ("customer_id") REFERENCES "public"."customers"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "rfp_responses" ADD CONSTRAINT "rfp_responses_rfp_id_rfps_id_fk" FOREIGN KEY ("rfp_id") REFERENCES "public"."rfps"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "rfp_versions" ADD CONSTRAINT "rfp_versions_rfp_id_rfps_id_fk" FOREIGN KEY ("rfp_id") REFERENCES "public"."rfps"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "learnings" ADD CONSTRAINT "learnings_customer_id_customers_id_fk" FOREIGN KEY ("customer_id") REFERENCES "public"."customers"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "customers_org_idx" ON "customers" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "knowledge_org_idx" ON "knowledge_entries" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "knowledge_customer_idx" ON "knowledge_entries" USING btree ("customer_id");--> statement-breakpoint
CREATE INDEX "rfps_org_idx" ON "rfps" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "rfps_customer_idx" ON "rfps" USING btree ("customer_id");--> statement-breakpoint
CREATE INDEX "rfps_user_idx" ON "rfps" USING btree ("assigned_user_id");--> statement-breakpoint
CREATE INDEX "rfps_status_idx" ON "rfps" USING btree ("status");--> statement-breakpoint
CREATE INDEX "responses_rfp_idx" ON "rfp_responses" USING btree ("rfp_id");--> statement-breakpoint
CREATE INDEX "responses_status_idx" ON "rfp_responses" USING btree ("status");--> statement-breakpoint
CREATE INDEX "versions_rfp_idx" ON "rfp_versions" USING btree ("rfp_id");--> statement-breakpoint
CREATE INDEX "versions_number_idx" ON "rfp_versions" USING btree ("rfp_id","version_number");--> statement-breakpoint
CREATE INDEX "learnings_org_idx" ON "learnings" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "learnings_customer_idx" ON "learnings" USING btree ("customer_id");