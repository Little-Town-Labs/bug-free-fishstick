import { NextRequest, NextResponse } from 'next/server'
import { requireAuthLimited, AuthError } from '@/lib/utils/auth'
import { searchContentLibrary } from '@/lib/services/content-library-search'

export async function GET(request: NextRequest) {
  try {
    const authContext = await requireAuthLimited()
    const query = request.nextUrl.searchParams.get('q')
    const limitParam = request.nextUrl.searchParams.get('limit')

    if (!query) {
      return NextResponse.json({ error: 'Query parameter "q" is required' }, { status: 400 })
    }

    const limit = limitParam ? Math.min(parseInt(limitParam, 10), 20) : 5

    const entries = await searchContentLibrary(query, authContext.orgId, limit)

    return NextResponse.json({ entries }, { status: 200 })
  } catch (err) {
    if (err instanceof AuthError) {
      return NextResponse.json({ error: err.message }, { status: err.statusCode })
    }
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
