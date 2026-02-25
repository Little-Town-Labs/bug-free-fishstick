-- Modified: tenant_settings — rate card, proposal defaults, company profile
ALTER TABLE "tenant_settings" ADD COLUMN "rate_card" jsonb;--> statement-breakpoint
ALTER TABLE "tenant_settings" ADD COLUMN "proposal_defaults" jsonb;--> statement-breakpoint
ALTER TABLE "tenant_settings" ADD COLUMN "company_profile" text;--> statement-breakpoint

-- Proposal templates table (boilerplate sections per org with smart triggers)
CREATE TABLE "proposal_templates" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "organization_id" text NOT NULL,
  "section" text NOT NULL CHECK (section IN (
    'assumptions','exclusions','payment_terms','change_management',
    'ip_ownership','liability','force_majeure','warranty'
  )),
  "title" text NOT NULL,
  "content" text NOT NULL,
  "is_required" boolean DEFAULT false NOT NULL,
  "trigger_rfp_types" jsonb,
  "trigger_industry_tags" jsonb,
  "evaluate_coverage" boolean DEFAULT false NOT NULL,
  "sort_order" integer DEFAULT 0 NOT NULL,
  "created_by" text NOT NULL,
  "created_at" timestamp DEFAULT now() NOT NULL,
  "updated_at" timestamp DEFAULT now() NOT NULL
);--> statement-breakpoint

-- Indexes for proposal_templates
CREATE INDEX "proposal_templates_org_idx" ON "proposal_templates" ("organization_id");--> statement-breakpoint
CREATE INDEX "proposal_templates_org_section_idx" ON "proposal_templates" ("organization_id", "section");--> statement-breakpoint
CREATE INDEX "proposal_templates_org_required_idx" ON "proposal_templates" ("organization_id", "is_required");--> statement-breakpoint

-- Modified: proposal_drafts — coverage report from bid engine evaluation
ALTER TABLE "proposal_drafts" ADD COLUMN "coverage_report" jsonb;
