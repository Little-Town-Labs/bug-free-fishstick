import { NextRequest, NextResponse } from 'next/server'
import { clerkClient } from '@clerk/nextjs/server'
import { requireAuthLimited, isAdmin, AuthError } from '@/lib/utils/auth'
import { authErrorResponse } from '@/lib/utils/api-error'
import { readJsonBody } from '@/lib/utils/request'

export async function POST(request: NextRequest) {
  try {
    const auth = await requireAuthLimited('strict')

    if (!isAdmin(auth.orgRole)) {
      return NextResponse.json({ error: 'Admin access required' }, { status: 403 })
    }

    const body = await readJsonBody(request)

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
      return authErrorResponse(error)
    }
    console.error('[POST /api/users/invite]', error instanceof Error ? error.message : String(error))
    const message =
      error instanceof Error ? error.message : 'Failed to send invitation'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
