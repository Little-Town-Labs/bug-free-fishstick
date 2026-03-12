import { NextRequest, NextResponse } from 'next/server'
import { requireAuth, isAdmin, AuthError } from '@/lib/utils/auth'
import { db } from '@/lib/db'
import { tenantSettings, llmProviders } from '@/lib/db/schema'
import type { LlmProvider } from '@/lib/db/schema'
import { eq, sql } from 'drizzle-orm'
import { encrypt } from '@/lib/services/encryption'

const DEFAULT_SETTINGS = {
  llmProvider: 'claude' as LlmProvider,
  llmApiKeyEncrypted: null as string | null,
  confidenceThreshold: 0.7,
  autoLearnEnabled: true,
}

// GET /api/settings — any authenticated org member
export async function GET() {
  try {
    const auth = await requireAuth()

    const [rowResult, keyRowResult] = await Promise.allSettled([
      db.select({
        llmProvider: tenantSettings.llmProvider,
        llmApiKeyEncrypted: tenantSettings.llmApiKeyEncrypted,
        confidenceThreshold: tenantSettings.confidenceThreshold,
        autoLearnEnabled: tenantSettings.autoLearnEnabled,
      })
        .from(tenantSettings)
        .where(eq(tenantSettings.organizationId, auth.orgId))
        .limit(1),
      db.select({
        openai: tenantSettings.openaiApiKeyEncrypted,
        anthropic: tenantSettings.anthropicApiKeyEncrypted,
      })
        .from(tenantSettings)
        .where(eq(tenantSettings.organizationId, auth.orgId))
        .limit(1),
    ])

    const [row] = rowResult.status === 'fulfilled' ? rowResult.value : [undefined]
    const [keyRow] = keyRowResult.status === 'fulfilled' ? keyRowResult.value : [undefined]
    if (keyRowResult.status === 'rejected') {
      console.warn('[GET /api/settings] new key columns not available yet:', String(keyRowResult.reason))
    }

    const openaiConfigured = keyRow?.openai !== null && keyRow?.openai !== undefined
    const anthropicConfigured = keyRow?.anthropic !== null && keyRow?.anthropic !== undefined

    return NextResponse.json({
      settings: {
        llmProvider: row?.llmProvider ?? DEFAULT_SETTINGS.llmProvider,
        llmApiKeyConfigured: (row?.llmApiKeyEncrypted ?? null) !== null,
        openaiApiKeyConfigured: openaiConfigured,
        anthropicApiKeyConfigured: anthropicConfigured,
        confidenceThreshold: row?.confidenceThreshold ?? DEFAULT_SETTINGS.confidenceThreshold,
        autoLearnEnabled: row?.autoLearnEnabled ?? DEFAULT_SETTINGS.autoLearnEnabled,
      }
    })
  } catch (error) {
    console.error('[GET /api/settings]', error)
    if (error instanceof AuthError) {
      return NextResponse.json({ error: error.message }, { status: error.statusCode })
    }
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// PATCH /api/settings — admin only
// Pass null for a key to delete it (e.g. { openaiApiKey: null })
export async function PATCH(request: NextRequest) {
  try {
    const auth = await requireAuth()

    if (!isAdmin(auth.orgRole)) {
      return NextResponse.json({ error: 'Admin access required' }, { status: 403 })
    }

    const body = await request.json()

    if (body.llmProvider !== undefined && !llmProviders.includes(body.llmProvider)) {
      return NextResponse.json({ error: 'Invalid LLM provider' }, { status: 400 })
    }

    // Ensure row exists first
    await db.execute(sql`
      INSERT INTO tenant_settings (organization_id, llm_provider, confidence_threshold, auto_learn_enabled)
      VALUES (${auth.orgId}, 'claude', 0.7, true)
      ON CONFLICT (organization_id) DO NOTHING
    `)

    // Apply each field update in parallel; migration fallbacks are idempotent
    await Promise.all([
      body.llmProvider !== undefined
        ? db.execute(sql`UPDATE tenant_settings SET llm_provider = ${body.llmProvider}, updated_at = now() WHERE organization_id = ${auth.orgId}`)
        : null,
      body.llmApiKey !== undefined
        ? db.execute(sql`UPDATE tenant_settings SET llm_api_key_encrypted = ${body.llmApiKey === null ? null : encrypt(body.llmApiKey)}, updated_at = now() WHERE organization_id = ${auth.orgId}`)
        : null,
      body.openaiApiKey !== undefined
        ? (async () => {
            try {
              await db.execute(sql`UPDATE tenant_settings SET openai_api_key_encrypted = ${body.openaiApiKey === null ? null : encrypt(body.openaiApiKey)}, updated_at = now() WHERE organization_id = ${auth.orgId}`)
            } catch (e) {
              console.warn('[PATCH /api/settings] openai column missing, running migration:', String(e))
              await db.execute(sql`ALTER TABLE tenant_settings ADD COLUMN IF NOT EXISTS openai_api_key_encrypted text`)
              await db.execute(sql`UPDATE tenant_settings SET openai_api_key_encrypted = ${body.openaiApiKey === null ? null : encrypt(body.openaiApiKey)}, updated_at = now() WHERE organization_id = ${auth.orgId}`)
            }
          })()
        : null,
      body.anthropicApiKey !== undefined
        ? (async () => {
            try {
              await db.execute(sql`UPDATE tenant_settings SET anthropic_api_key_encrypted = ${body.anthropicApiKey === null ? null : encrypt(body.anthropicApiKey)}, updated_at = now() WHERE organization_id = ${auth.orgId}`)
            } catch (e) {
              console.warn('[PATCH /api/settings] anthropic column missing, running migration:', String(e))
              await db.execute(sql`ALTER TABLE tenant_settings ADD COLUMN IF NOT EXISTS anthropic_api_key_encrypted text`)
              await db.execute(sql`UPDATE tenant_settings SET anthropic_api_key_encrypted = ${body.anthropicApiKey === null ? null : encrypt(body.anthropicApiKey)}, updated_at = now() WHERE organization_id = ${auth.orgId}`)
            }
          })()
        : null,
    ].filter(Boolean))

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('[PATCH /api/settings]', error)
    if (error instanceof AuthError) {
      return NextResponse.json({ error: error.message }, { status: error.statusCode })
    }
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
