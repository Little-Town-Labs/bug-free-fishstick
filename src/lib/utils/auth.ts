import { auth } from '@clerk/nextjs/server'

export interface AuthContext {
  userId: string
  orgId: string
  orgRole: string
}

export async function getAuthContext(): Promise<AuthContext | null> {
  const { userId, orgId, orgRole } = await auth()
  if (!userId || !orgId) return null
  return { userId, orgId, orgRole: orgRole || 'org:member' }
}

export async function requireAuth(): Promise<AuthContext> {
  const context = await getAuthContext()
  if (!context) {
    throw new AuthError('Authentication required', 401)
  }
  return context
}

export async function requireAdmin(): Promise<AuthContext> {
  const context = await requireAuth()
  if (!isAdmin(context.orgRole)) {
    throw new AuthError('Admin access required', 403)
  }
  return context
}

export function isAdmin(orgRole: string): boolean {
  return orgRole === 'org:admin'
}

export class AuthError extends Error {
  constructor(
    message: string,
    public statusCode: number
  ) {
    super(message)
    this.name = 'AuthError'
  }
}
