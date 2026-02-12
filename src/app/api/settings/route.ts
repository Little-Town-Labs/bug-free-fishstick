import { NextRequest, NextResponse } from 'next/server'
import { requireAuth, isAdmin, AuthError } from '@/lib/utils/auth'
import { db } from '@/lib/db'
import { tenantSettings, llmProviders } from '@/lib/db/schema'
import type { LlmProvider } from '@/lib/db/schema'
import { eq } from 'drizzle-orm'
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

    const [row] = await db
      .select({
        llmProvider: tenantSettings.llmProvider,
        llmApiKeyEncrypted: tenantSettings.llmApiKeyEncrypted,
        confidenceThreshold: tenantSettings.confidenceThreshold,
        autoLearnEnabled: tenantSettings.autoLearnEnabled,
      })
      .from(tenantSettings)
      .where(eq(tenantSettings.organizationId, auth.orgId))
      .limit(1)

    // Fetch new key columns separately — safe if migration hasn't run yet
    let openaiConfigured = false
    let anthropicConfigured = false
    try {
      const [keyRow] = await db
        .select({
          openai: tenantSettings.openaiApiKeyEncrypted,
          anthropic: tenantSettings.anthropicApiKeyEncrypted,
        })
        .from(tenantSettings)
        .where(eq(tenantSettings.organizationId, auth.orgId))
        .limit(1)
      openaiConfigured = keyRow?.openai !== null && keyRow?.openai !== undefined
      anthropicConfigured = keyRow?.anthropic !== null && keyRow?.anthropic !== undefined
    } catch (e) {
      console.warn('[GET /api/settings] new key columns not available yet:', String(e))
    }

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
    return NextResponse.json({ error: String(error) }, { status: 500 })
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

    // Update base settings (original columns only)
    const baseUpdate: Record<string, unknown> = { updatedAt: new Date() }
    if (body.llmProvider !== undefined) baseUpdate.llmProvider = body.llmProvider
    if (body.llmApiKey !== undefined) baseUpdate.llmApiKeyEncrypted = body.llmApiKey === null ? null : encrypt(body.llmApiKey)
    if (body.confidenceThreshold !== undefined) baseUpdate.confidenceThreshold = body.confidenceThreshold
    if (body.autoLearnEnabled !== undefined) baseUpdate.autoLearnEnabled = body.autoLearnEnabled

    await db
      .insert(tenantSettings)
      .values({ organizationId: auth.orgId, ...DEFAULT_SETTINGS })
      .onConflictDoUpdate({ target: tenantSettings.organizationId, set: baseUpdate })

    // Update new key columns separately — safe if migration hasn't run yet
    if (body.openaiApiKey !== undefined || body.anthropicApiKey !== undefined) {
      try {
        const keyUpdate: Record<string, unknown> = { updatedAt: new Date() }
        if (body.openaiApiKey !== undefined) keyUpdate.openaiApiKeyEncrypted = body.openaiApiKey === null ? null : encrypt(body.openaiApiKey)
        if (body.anthropicApiKey !== undefined) keyUpdate.anthropicApiKeyEncrypted = body.anthropicApiKey === null ? null : encrypt(body.anthropicApiKey)

        await db
          .update(tenantSettings)
          .set(keyUpdate)
          .where(eq(tenantSettings.organizationId, auth.orgId))
      } catch (e) {
        console.warn('[PATCH /api/settings] new key columns not available yet:', String(e))
      }
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('[PATCH /api/settings]', error)
    if (error instanceof AuthError) {
      return NextResponse.json({ error: error.message }, { status: error.statusCode })
    }
    return NextResponse.json({ error: String(error) }, { status: 500 })
  }
}
