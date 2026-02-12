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

function toResponse(data: {
  organizationId: string
  llmProvider: LlmProvider
  llmApiKeyEncrypted: string | null
  openaiApiKeyEncrypted?: string | null
  anthropicApiKeyEncrypted?: string | null
  confidenceThreshold: number
  autoLearnEnabled: boolean
  createdAt: Date | string
  updatedAt: Date | string
}) {
  return {
    organizationId: data.organizationId,
    llmProvider: data.llmProvider,
    llmApiKeyConfigured: data.llmApiKeyEncrypted !== null,
    openaiApiKeyConfigured: data.openaiApiKeyEncrypted != null,
    anthropicApiKeyConfigured: data.anthropicApiKeyEncrypted != null,
    confidenceThreshold: data.confidenceThreshold,
    autoLearnEnabled: data.autoLearnEnabled,
    createdAt: data.createdAt,
    updatedAt: data.updatedAt,
  }
}

// GET /api/settings — any authenticated org member
export async function GET() {
  try {
    const auth = await requireAuth()

    const [row] = await db
      .select()
      .from(tenantSettings)
      .where(eq(tenantSettings.organizationId, auth.orgId))
      .limit(1)

    const data = row ?? {
      ...DEFAULT_SETTINGS,
      organizationId: auth.orgId,
      createdAt: new Date(),
      updatedAt: new Date(),
    }

    return NextResponse.json({ settings: toResponse(data) })
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json({ error: error.message }, { status: error.statusCode })
    }
    throw error
  }
}

// PATCH /api/settings — admin only
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

    const updateValues: Record<string, unknown> = { updatedAt: new Date() }
    if (body.llmProvider !== undefined) updateValues.llmProvider = body.llmProvider
    if (body.llmApiKey !== undefined) updateValues.llmApiKeyEncrypted = encrypt(body.llmApiKey)
    if (body.openaiApiKey !== undefined) updateValues.openaiApiKeyEncrypted = encrypt(body.openaiApiKey)
    if (body.anthropicApiKey !== undefined) updateValues.anthropicApiKeyEncrypted = encrypt(body.anthropicApiKey)
    if (body.confidenceThreshold !== undefined) updateValues.confidenceThreshold = body.confidenceThreshold
    if (body.autoLearnEnabled !== undefined) updateValues.autoLearnEnabled = body.autoLearnEnabled

    const [updated] = await db
      .insert(tenantSettings)
      .values({
        organizationId: auth.orgId,
        ...DEFAULT_SETTINGS,
        ...(updateValues as Partial<typeof DEFAULT_SETTINGS>),
      })
      .onConflictDoUpdate({
        target: tenantSettings.organizationId,
        set: updateValues,
      })
      .returning()

    if (!updated) {
      return NextResponse.json({ error: 'Failed to update settings' }, { status: 500 })
    }

    return NextResponse.json({ settings: toResponse(updated) })
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json({ error: error.message }, { status: error.statusCode })
    }
    throw error
  }
}
