import { auth } from '@clerk/nextjs/server'
import { NextResponse } from 'next/server'

export async function GET() {
  const { userId, orgId, orgRole } = await auth()
  return NextResponse.json({ userId, orgId, orgRole })
}
