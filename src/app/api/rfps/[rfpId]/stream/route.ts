import { NextRequest } from 'next/server'
import { requireAuthLimited, AuthError } from '@/lib/utils/auth'
import { db } from '@/lib/db'
import { rfps } from '@/lib/db/schema/rfps'
import { eq, and } from 'drizzle-orm'
import { subscribeToRfpStream } from '@/lib/services/sse-publisher'

const HEARTBEAT_INTERVAL_MS = 30_000

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ rfpId: string }> }
) {
  try {
    const auth = await requireAuthLimited()
    const { rfpId } = await params

    // Verify org-scoped RFP access
    const [rfp] = await db
      .select({ id: rfps.id })
      .from(rfps)
      .where(and(eq(rfps.id, rfpId), eq(rfps.organizationId, auth.orgId)))
      .limit(1)

    if (!rfp) {
      return new Response(JSON.stringify({ error: 'Not found' }), { status: 404 })
    }

    const encoder = new TextEncoder()
    const signal = request.signal

    const stream = new ReadableStream({
      async start(controller) {
        // Heartbeat to keep connection alive
        const heartbeat = setInterval(() => {
          try {
            controller.enqueue(encoder.encode(': heartbeat\n\n'))
          } catch {
            clearInterval(heartbeat)
          }
        }, HEARTBEAT_INTERVAL_MS)

        signal.addEventListener('abort', () => {
          clearInterval(heartbeat)
          try { controller.close() } catch { /* already closed */ }
        })

        // Subscribe to field updates
        try {
          await subscribeToRfpStream(
            rfpId,
            (message) => {
              try {
                controller.enqueue(encoder.encode(`data: ${message}\n\n`))
              } catch { /* stream closed */ }
            },
            signal
          )
        } catch {
          // Subscription ended (abort signal)
        } finally {
          clearInterval(heartbeat)
        }
      },
    })

    return new Response(stream, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache, no-transform',
        Connection: 'keep-alive',
        'X-Accel-Buffering': 'no',
      },
    })
  } catch (error) {
    if (error instanceof AuthError) {
      return new Response(JSON.stringify({ error: error.message }), { status: error.statusCode })
    }
    return new Response(JSON.stringify({ error: 'Internal server error' }), { status: 500 })
  }
}
