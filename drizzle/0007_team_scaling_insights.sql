-- Analytics snapshots table (pre-computed org metrics)
CREATE TABLE "analytics_snapshots" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "organization_id" text NOT NULL,
  "snapshot_date" date NOT NULL,
  "period" text NOT NULL,
  "metric_key" text NOT NULL,
  "dimension_key" text,
  "metric_value" real NOT NULL,
  "metadata_json" jsonb,
  "computed_at" timestamp DEFAULT now() NOT NULL
);--> statement-breakpoint

-- Integration configs table (per-org external integration credentials)
CREATE TABLE "integration_configs" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "organization_id" text NOT NULL,
  "integration_type" text NOT NULL,
  "is_enabled" boolean DEFAULT true NOT NULL,
  "credentials_encrypted" text NOT NULL,
  "config_json" jsonb DEFAULT '{}' NOT NULL,
  "status" text DEFAULT 'active' NOT NULL,
  "last_verified_at" timestamp,
  "created_at" timestamp DEFAULT now() NOT NULL,
  "updated_at" timestamp DEFAULT now() NOT NULL
);--> statement-breakpoint

-- Sync events table (audit log + retry queue for outbound integration calls)
CREATE TABLE "sync_events" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "organization_id" text NOT NULL,
  "integration_config_id" uuid NOT NULL,
  "integration_type" text NOT NULL,
  "event_type" text NOT NULL,
  "reference_id" text NOT NULL,
  "status" text DEFAULT 'pending' NOT NULL,
  "inngest_event_id" text,
  "request_payload" jsonb,
  "response_payload" jsonb,
  "error_message" text,
  "attempt_count" integer DEFAULT 0 NOT NULL,
  "last_attempt_at" timestamp,
  "created_at" timestamp DEFAULT now() NOT NULL
);--> statement-breakpoint

-- Foreign key: sync_events → integration_configs
ALTER TABLE "sync_events" ADD CONSTRAINT "sync_events_integration_config_id_fk"
  FOREIGN KEY ("integration_config_id") REFERENCES "integration_configs"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;--> statement-breakpoint

-- Unique constraints
CREATE UNIQUE INDEX "analytics_snapshots_unique_idx" ON "analytics_snapshots"
  ("organization_id", "snapshot_date", "period", "metric_key", "dimension_key");--> statement-breakpoint
CREATE UNIQUE INDEX "integration_configs_unique_idx" ON "integration_configs"
  ("organization_id", "integration_type");--> statement-breakpoint

-- Indexes for analytics_snapshots
CREATE INDEX "analytics_snapshots_org_period_idx" ON "analytics_snapshots"
  ("organization_id", "period", "metric_key");--> statement-breakpoint

-- Indexes for integration_configs
CREATE INDEX "integration_configs_org_idx" ON "integration_configs" ("organization_id");--> statement-breakpoint

-- Indexes for sync_events
CREATE INDEX "sync_events_org_status_idx" ON "sync_events" ("organization_id", "status");--> statement-breakpoint
CREATE INDEX "sync_events_reference_idx" ON "sync_events" ("reference_id");--> statement-breakpoint
CREATE INDEX "sync_events_org_idx" ON "sync_events" ("organization_id");--> statement-breakpoint

-- Modified: rfps table — outcome tracking columns
ALTER TABLE "rfps" ADD COLUMN "outcome" text;--> statement-breakpoint
ALTER TABLE "rfps" ADD COLUMN "outcome_set_at" timestamp;--> statement-breakpoint
ALTER TABLE "rfps" ADD COLUMN "crm_deal_id" text;--> statement-breakpoint

-- Modified: rfp_responses table — optimistic locking version
ALTER TABLE "rfp_responses" ADD COLUMN "version" integer DEFAULT 1 NOT NULL;
