import { NextRequest, NextResponse } from 'next/server'
import { Webhook } from 'svix'
import { db } from '@/lib/db'
import { tenantSettings } from '@/lib/db/schema/tenant-settings'
import { eq } from 'drizzle-orm'

const WEBHOOK_SECRET = process.env.CLERK_WEBHOOK_SECRET

export async function POST(req: NextRequest) {
  if (!WEBHOOK_SECRET) {
    return NextResponse.json({ error: 'Webhook secret not configured' }, { status: 500 })
  }

  const svixId = req.headers.get('svix-id')
  const svixTimestamp = req.headers.get('svix-timestamp')
  const svixSignature = req.headers.get('svix-signature')

  if (!svixId || !svixTimestamp || !svixSignature) {
    return NextResponse.json({ error: 'Missing svix headers' }, { status: 400 })
  }

  const body = await req.text()

  let payload: { type: string; data: { id: string } }
  try {
    const wh = new Webhook(WEBHOOK_SECRET)
    payload = wh.verify(body, {
      'svix-id': svixId,
      'svix-timestamp': svixTimestamp,
      'svix-signature': svixSignature,
    }) as typeof payload
  } catch {
    return NextResponse.json({ error: 'Invalid webhook signature' }, { status: 400 })
  }

  try {
    switch (payload.type) {
      case 'organization.created': {
        const orgId = payload.data.id
        await db.insert(tenantSettings).values({
          organizationId: orgId,
        }).onConflictDoNothing()
        return NextResponse.json({ received: true }, { status: 200 })
      }
      case 'organization.deleted': {
        const orgId = payload.data.id
        await db.delete(tenantSettings).where(eq(tenantSettings.organizationId, orgId))
        return NextResponse.json({ received: true }, { status: 200 })
      }
      default:
        return NextResponse.json({ received: true }, { status: 200 })
    }
  } catch {
    return NextResponse.json({ error: 'Webhook processing failed' }, { status: 500 })
  }
}
