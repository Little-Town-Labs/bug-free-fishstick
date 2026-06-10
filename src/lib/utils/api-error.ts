import { NextResponse } from 'next/server'
import type { AuthError } from './auth'

/**
 * Standard JSON response for an AuthError thrown by route helpers
 * (requireAuthLimited, requireAdminLimited, readJsonBody, ...). Includes any
 * headers attached to the error, e.g. rate-limit headers on a 429.
 *
 * Type-only dependency on the auth module so that test files mocking
 * '@/lib/utils/auth' don't need to stub this helper.
 */
export function authErrorResponse(error: AuthError): NextResponse {
  return NextResponse.json(
    { error: error.message },
    { status: error.statusCode, headers: error.headers }
  )
}
