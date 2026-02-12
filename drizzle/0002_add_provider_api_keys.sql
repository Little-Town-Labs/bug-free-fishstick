ALTER TABLE "tenant_settings" ADD COLUMN IF NOT EXISTS "openai_api_key_encrypted" text;
ALTER TABLE "tenant_settings" ADD COLUMN IF NOT EXISTS "anthropic_api_key_encrypted" text;
