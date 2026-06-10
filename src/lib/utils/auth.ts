import { auth } from '@clerk/nextjs/server'
import { checkRateLimit, type RateLimitTier } from './rate-limit'

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

/**
 * requireAuth + per-user rate limiting. Throws AuthError(429) when the
 * limit is exceeded, which route handlers' existing AuthError catch
 * blocks translate into a 429 response.
 */
export async function requireAuthLimited(tier: RateLimitTier = 'standard'): Promise<AuthContext> {
  const context = await requireAuth()
  const limited = await checkRateLimit(context.userId, tier)
  if (limited) {
    throw new AuthError('Too many requests', 429)
  }
  return context
}

/** requireAdmin + per-user rate limiting. See requireAuthLimited. */
export async function requireAdminLimited(tier: RateLimitTier = 'standard'): Promise<AuthContext> {
  const context = await requireAdmin()
  const limited = await checkRateLimit(context.userId, tier)
  if (limited) {
    throw new AuthError('Too many requests', 429)
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
