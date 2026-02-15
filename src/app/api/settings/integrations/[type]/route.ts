import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin, AuthError } from '@/lib/utils/auth'
import {
  upsertIntegrationConfig,
  deleteIntegrationConfig,
  type IntegrationType,
} from '@/lib/services/integration-config'

const VALID_TYPES: IntegrationType[] = ['slack', 'salesforce', 'hubspot']

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ type: string }> }
) {
  try {
    const auth = await requireAdmin()
    const { type } = await params

    if (!VALID_TYPES.includes(type as IntegrationType)) {
      return NextResponse.json(
        { error: `Invalid integration type. Must be one of: ${VALID_TYPES.join(', ')}` },
        { status: 400 }
      )
    }

    const body = await request.json() as { credentials: Record<string, unknown>; config?: Record<string, unknown> }

    if (!body.credentials || typeof body.credentials !== 'object') {
      return NextResponse.json({ error: 'credentials is required' }, { status: 400 })
    }

    const summary = await upsertIntegrationConfig(auth.orgId, type as IntegrationType, body.credentials, body.config ?? {})
    return NextResponse.json({ integration: summary }, { status: 200 })
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json({ error: error.message }, { status: error.statusCode })
    }
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ type: string }> }
) {
  try {
    const auth = await requireAdmin()
    const { type } = await params

    if (!VALID_TYPES.includes(type as IntegrationType)) {
      return NextResponse.json(
        { error: `Invalid integration type. Must be one of: ${VALID_TYPES.join(', ')}` },
        { status: 400 }
      )
    }

    await deleteIntegrationConfig(auth.orgId, type as IntegrationType)
    return new NextResponse(null, { status: 204 })
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json({ error: error.message }, { status: error.statusCode })
    }
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
