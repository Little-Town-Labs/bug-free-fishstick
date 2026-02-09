import { NextRequest, NextResponse } from 'next/server'

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const eventType = body.type as string

    switch (eventType) {
      case 'organization.created': {
        // TODO: Insert into tenant_settings when DB is connected
        return NextResponse.json({ received: true }, { status: 200 })
      }
      case 'organization.deleted': {
        // TODO: Clean up tenant data
        return NextResponse.json({ received: true }, { status: 200 })
      }
      default:
        return NextResponse.json({ received: true }, { status: 200 })
    }
  } catch {
    return NextResponse.json({ error: 'Webhook processing failed' }, { status: 400 })
  }
}
