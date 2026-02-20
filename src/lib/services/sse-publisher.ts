import { Redis } from '@upstash/redis'

let _redis: Redis | null = null
function getRedis(): Redis {
  if (!_redis) {
    _redis = new Redis({
      url: process.env.KV_REST_API_URL!,
      token: process.env.KV_REST_API_TOKEN!,
    })
  }
  return _redis
}

export interface FieldUpdatePayload {
  responseId: string
  fieldId: string
  value: string | null
  updatedBy: string
  version: number
  updatedAt: string
}

function channelName(rfpId: string): string {
  return `rfp-stream:${rfpId}`
}

/**
 * Publishes a field-update event to all subscribers watching the given RFP.
 */
export async function publishFieldUpdate(
  rfpId: string,
  payload: FieldUpdatePayload
): Promise<void> {
  await getRedis().publish(
    channelName(rfpId),
    JSON.stringify({ type: 'field-updated', ...payload })
  )
}

/**
 * Subscribes to field-update events for an RFP and invokes onMessage for each event.
 * Unsubscribes automatically when the AbortSignal fires.
 *
 * @param rfpId   - The RFP to watch
 * @param onMessage - Callback invoked with each raw message string
 * @param signal  - AbortSignal (e.g. from request.signal) to stop subscription
 */
export async function subscribeToRfpStream(
  rfpId: string,
  onMessage: (message: string) => void,
  signal: AbortSignal
): Promise<void> {
  const channel = channelName(rfpId)
  const subscriber = getRedis().subscribe([channel])

  subscriber.on('message', (data: { channel: string; message: unknown }) => {
    const raw = typeof data.message === 'string' ? data.message : JSON.stringify(data.message)
    onMessage(raw)
  })

  await new Promise<void>((resolve) => {
    signal.addEventListener('abort', () => {
      subscriber.unsubscribe().finally(resolve)
    })
  })
}
