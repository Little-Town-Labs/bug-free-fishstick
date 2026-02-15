import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin, AuthError } from '@/lib/utils/auth'
import { listSyncEvents, type SyncEventFilters } from '@/lib/services/integration-config'
import type { SyncEventStatus } from '@/lib/db/schema/sync-events'
import type { IntegrationType } from '@/lib/services/integration-config'

export async function GET(request: NextRequest) {
  try {
    const auth = await requireAdmin()
    const searchParams = request.nextUrl.searchParams

    const filters: SyncEventFilters = {}
    const status = searchParams.get('status')
    const integrationType = searchParams.get('integrationType')

    if (status) filters.status = status as SyncEventStatus
    if (integrationType) filters.integrationType = integrationType as IntegrationType

    const events = await listSyncEvents(auth.orgId, filters)
    return NextResponse.json({ events }, { status: 200 })
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json({ error: error.message }, { status: error.statusCode })
    }
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
