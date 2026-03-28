-- Migration: 0009_fixed_content_sections
-- Feature: 013-fixed-content-library-sections
-- Adds section_type column for fixed (system-defined) content library sections

ALTER TABLE "proposal_content_library" ADD COLUMN "section_type" text;

-- Composite index for fast fixed section lookup by org
CREATE INDEX "content_library_section_type_idx" ON "proposal_content_library" ("organization_id", "section_type");

-- Partial unique constraint: one fixed section per type per org
CREATE UNIQUE INDEX "content_library_org_section_type_uniq" ON "proposal_content_library" ("organization_id", "section_type") WHERE section_type IS NOT NULL;
