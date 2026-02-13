CREATE TABLE "proposal_content_library" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" text NOT NULL,
	"category" text NOT NULL,
	"name" text NOT NULL,
	"content" text NOT NULL,
	"created_by" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "proposal_drafts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"rfp_id" uuid NOT NULL,
	"organization_id" text NOT NULL,
	"created_by" text NOT NULL,
	"status" text DEFAULT 'awaiting_answers' NOT NULL,
	"clarifying_questions" jsonb,
	"markdown_content" text,
	"generation_error" text,
	"version" integer DEFAULT 1 NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "proposal_drafts" ADD CONSTRAINT "proposal_drafts_rfp_id_rfps_id_fk" FOREIGN KEY ("rfp_id") REFERENCES "public"."rfps"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "content_library_org_idx" ON "proposal_content_library" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "content_library_category_idx" ON "proposal_content_library" USING btree ("organization_id","category");--> statement-breakpoint
CREATE INDEX "proposal_drafts_rfp_idx" ON "proposal_drafts" USING btree ("rfp_id");--> statement-breakpoint
CREATE INDEX "proposal_drafts_org_idx" ON "proposal_drafts" USING btree ("organization_id");
