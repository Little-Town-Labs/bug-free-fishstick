import { NextResponse } from 'next/server'
import { requireAuthLimited, AuthError } from '@/lib/utils/auth'
import { listIntegrationConfigs } from '@/lib/services/integration-config'

export async function GET() {
  try {
    const auth = await requireAuthLimited()
    const configs = await listIntegrationConfigs(auth.orgId)
    return NextResponse.json({ integrations: configs }, { status: 200 })
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json({ error: error.message }, { status: error.statusCode })
    }
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
