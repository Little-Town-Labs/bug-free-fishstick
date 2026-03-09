import { NextRequest, NextResponse } from 'next/server'
import { clerkClient } from '@clerk/nextjs/server'
import { requireAuth, isAdmin, AuthError } from '@/lib/utils/auth'
import { checkRateLimit } from '@/lib/utils/rate-limit'

export async function POST(request: NextRequest) {
  try {
    const auth = await requireAuth()

    if (!isAdmin(auth.orgRole)) {
      return NextResponse.json({ error: 'Admin access required' }, { status: 403 })
    }

    const rateLimited = await checkRateLimit(auth.userId, 'strict')
    if (rateLimited) return rateLimited

    const body = await request.json()

    if (!body.email || typeof body.email !== 'string') {
      return NextResponse.json({ error: 'Email is required' }, { status: 400 })
    }

    const role = body.role === 'org:admin' ? 'org:admin' : 'org:member'
    const redirectUrl = process.env.NEXT_PUBLIC_APP_URL
      ? `${process.env.NEXT_PUBLIC_APP_URL}/sign-in`
      : undefined

    const client = await clerkClient()
    const invitation = await client.organizations.createOrganizationInvitation({
      organizationId: auth.orgId,
      emailAddress: body.email,
      role,
      ...(redirectUrl ? { redirectUrl } : {}),
    })

    return NextResponse.json({ invitation }, { status: 201 })
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json({ error: error.message }, { status: error.statusCode })
    }
    throw error
  }
}
