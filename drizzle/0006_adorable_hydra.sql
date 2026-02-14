ALTER TABLE "knowledge_entries" ADD COLUMN "chunk_index" integer;--> statement-breakpoint
ALTER TABLE "knowledge_entries" ADD COLUMN "total_chunks" integer;--> statement-breakpoint
ALTER TABLE "knowledge_entries" ADD COLUMN "section_heading" text;--> statement-breakpoint
ALTER TABLE "knowledge_entries" ADD COLUMN "tags" jsonb;--> statement-breakpoint
ALTER TABLE "knowledge_entries" ADD COLUMN "source_entry_id" uuid;--> statement-breakpoint
ALTER TABLE "knowledge_entries" ADD COLUMN "processing_status" text DEFAULT 'complete' NOT NULL;--> statement-breakpoint
ALTER TABLE "rfps" ADD COLUMN "rfp_type" text;--> statement-breakpoint
ALTER TABLE "rfps" ADD COLUMN "complexity" text;--> statement-breakpoint
ALTER TABLE "rfps" ADD COLUMN "industry_tags" jsonb;--> statement-breakpoint
ALTER TABLE "rfps" ADD COLUMN "suggested_assignee_id" text;--> statement-breakpoint
ALTER TABLE "learnings" ADD COLUMN "field_id" text;--> statement-breakpoint
ALTER TABLE "learnings" ADD COLUMN "question_type" text;--> statement-breakpoint
ALTER TABLE "learnings" ADD COLUMN "confidence" real;--> statement-breakpoint
ALTER TABLE "proposal_content_library" ADD COLUMN "embedding" vector(1536);--> statement-breakpoint
CREATE INDEX "knowledge_source_entry_idx" ON "knowledge_entries" USING btree ("source_entry_id");--> statement-breakpoint
CREATE INDEX "knowledge_processing_idx" ON "knowledge_entries" USING btree ("organization_id","processing_status");--> statement-breakpoint
CREATE INDEX "rfps_type_idx" ON "rfps" USING btree ("organization_id","rfp_type");--> statement-breakpoint
CREATE INDEX "rfps_complexity_idx" ON "rfps" USING btree ("organization_id","complexity");