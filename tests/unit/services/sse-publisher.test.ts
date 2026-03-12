import { describe, it, expect, vi, beforeEach } from 'vitest'

const { mockPublish, mockUnsubscribe, mockSubscriber, mockSubscribe } = vi.hoisted(() => {
  const mockUnsubscribe = vi.fn().mockResolvedValue(undefined)
  const mockSubscriber = {
    on: vi.fn(),
    unsubscribe: mockUnsubscribe,
  }
  const mockSubscribe = vi.fn().mockReturnValue(mockSubscriber)
  const mockPublish = vi.fn().mockResolvedValue(1)
  return { mockPublish, mockUnsubscribe, mockSubscriber, mockSubscribe }
})

vi.mock('@/lib/storage/kv', () => ({
  getRedis: vi.fn(() => ({
    publish: mockPublish,
    subscribe: mockSubscribe,
  })),
}))

import { publishFieldUpdate, subscribeToRfpStream } from '@/lib/services/sse-publisher'
import type { FieldUpdatePayload } from '@/lib/services/sse-publisher'

describe('publishFieldUpdate', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockSubscriber.on = vi.fn()
    mockSubscriber.unsubscribe = mockUnsubscribe
    mockSubscribe.mockReturnValue(mockSubscriber)
  })

  it('publishes serialized payload to the correct channel', async () => {
    const payload: FieldUpdatePayload = {
      responseId: 'resp-1',
      fieldId: 'field-abc',
      value: 'Hello world',
      updatedBy: 'user-1',
      version: 2,
      updatedAt: '2024-01-01T00:00:00.000Z',
    }

    await publishFieldUpdate('rfp-123', payload)

    expect(mockPublish).toHaveBeenCalledOnce()
    const [channel, message] = mockPublish.mock.calls[0] as [string, string]
    expect(channel).toBe('rfp-stream:rfp-123')

    const parsed = JSON.parse(message) as Record<string, unknown>
    expect(parsed.type).toBe('field-updated')
    expect(parsed.fieldId).toBe('field-abc')
    expect(parsed.value).toBe('Hello world')
    expect(parsed.version).toBe(2)
    expect(parsed.updatedBy).toBe('user-1')
  })

  it('uses the rfpId to build the channel name', async () => {
    const payload: FieldUpdatePayload = {
      responseId: 'r',
      fieldId: 'f',
      value: null,
      updatedBy: 'u',
      version: 1,
      updatedAt: new Date().toISOString(),
    }

    await publishFieldUpdate('my-rfp-xyz', payload)

    const [channel] = mockPublish.mock.calls[0] as [string, string]
    expect(channel).toBe('rfp-stream:my-rfp-xyz')
  })
})

describe('subscribeToRfpStream', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockSubscriber.on = vi.fn()
    mockSubscriber.unsubscribe = mockUnsubscribe
    mockSubscribe.mockReturnValue(mockSubscriber)
  })

  it('subscribes to the correct channel name', async () => {
    const controller = new AbortController()
    const onMessage = vi.fn()

    const promise = subscribeToRfpStream('rfp-abc', onMessage, controller.signal)
    controller.abort()
    await promise

    expect(mockSubscribe).toHaveBeenCalledWith(['rfp-stream:rfp-abc'])
  })

  it('invokes onMessage callback with raw string messages', async () => {
    const controller = new AbortController()
    const onMessage = vi.fn()

    const promise = subscribeToRfpStream('rfp-def', onMessage, controller.signal)

    // Simulate a message arriving by calling the registered 'message' handler
    const onCall = mockSubscriber.on.mock.calls.find((args: unknown[]) => args[0] === 'message')
    expect(onCall).toBeDefined()
    const handler = onCall![1] as (data: { channel: string; message: unknown }) => void
    handler({ channel: 'rfp-stream:rfp-def', message: '{"type":"field-updated"}' })

    expect(onMessage).toHaveBeenCalledWith('{"type":"field-updated"}')

    controller.abort()
    await promise
  })

  it('serializes non-string message objects to JSON', async () => {
    const controller = new AbortController()
    const onMessage = vi.fn()

    const promise = subscribeToRfpStream('rfp-ghi', onMessage, controller.signal)

    const onCall = mockSubscriber.on.mock.calls.find((args: unknown[]) => args[0] === 'message')
    const handler = onCall![1] as (data: { channel: string; message: unknown }) => void
    handler({ channel: 'rfp-stream:rfp-ghi', message: { key: 'value' } })

    expect(onMessage).toHaveBeenCalledWith('{"key":"value"}')

    controller.abort()
    await promise
  })

  it('unsubscribes when the abort signal fires', async () => {
    const controller = new AbortController()
    const onMessage = vi.fn()

    const promise = subscribeToRfpStream('rfp-jkl', onMessage, controller.signal)
    controller.abort()
    await promise

    expect(mockUnsubscribe).toHaveBeenCalledOnce()
  })
})
