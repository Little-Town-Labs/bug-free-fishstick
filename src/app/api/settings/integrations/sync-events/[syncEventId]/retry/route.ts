import { NextRequest, NextResponse } from 'next/server'
import { requireAdminLimited, AuthError } from '@/lib/utils/auth'
import { getSyncEvent } from '@/lib/services/integration-config'
import { inngest } from '@/lib/inngest/client'

export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ syncEventId: string }> }
) {
  try {
    await requireAdminLimited()
    const { syncEventId } = await params

    const syncEvent = await getSyncEvent(syncEventId)
    if (!syncEvent) {
      return NextResponse.json({ error: 'Sync event not found' }, { status: 404 })
    }

    if (syncEvent.status !== 'failed') {
      return NextResponse.json(
        { error: `Only failed sync events can be retried. Current status: ${syncEvent.status}` },
        { status: 400 }
      )
    }

    await inngest.send({
      name: 'integration/retry-failed',
      data: { syncEventId, organizationId: syncEvent.organizationId },
    })

    return NextResponse.json({ ok: true, syncEventId }, { status: 202 })
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json({ error: error.message }, { status: error.statusCode })
    }
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
