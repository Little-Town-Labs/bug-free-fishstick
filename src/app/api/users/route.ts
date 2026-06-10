import { NextRequest, NextResponse } from 'next/server'
import { clerkClient } from '@clerk/nextjs/server'
import { requireAuthLimited, isAdmin, AuthError } from '@/lib/utils/auth'
import { readJsonBody } from '@/lib/utils/request'

export async function GET() {
  try {
    const auth = await requireAuthLimited()
    const client = await clerkClient()

    const membershipsResult = await client.organizations.getOrganizationMembershipList({
      organizationId: auth.orgId,
    })

    const members = membershipsResult.data.map((membership) => ({
      userId: membership.publicUserData?.userId ?? '',
      email: membership.publicUserData?.identifier ?? '',
      firstName: membership.publicUserData?.firstName ?? undefined,
      lastName: membership.publicUserData?.lastName ?? undefined,
      orgRole: membership.role,
      joinedAt: membership.createdAt
        ? new Date(membership.createdAt).toISOString()
        : new Date().toISOString(),
    }))

    return NextResponse.json(
      { members, isAdmin: isAdmin(auth.orgRole) },
      { status: 200 }
    )
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json({ error: error.message }, { status: error.statusCode })
    }
    throw error
  }
}

export async function POST(request: NextRequest) {
  try {
    const auth = await requireAuthLimited()

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
      return NextResponse.json({ error: error.message }, { status: error.statusCode })
    }
    throw error
  }
}
