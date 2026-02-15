'use client'

import { useState, useEffect, useRef } from 'react'
import type { PresenceEntry } from '@/app/api/rfps/[rfpId]/presence/route'

interface PresenceIndicatorProps {
  rfpId: string
  currentUserId: string
  displayName?: string
}

const COLORS = ['#6366f1', '#ec4899', '#f59e0b', '#10b981', '#3b82f6', '#ef4444']

function colorForUser(userId: string): string {
  let hash = 0
  for (let i = 0; i < userId.length; i++) hash = userId.charCodeAt(i) + ((hash << 5) - hash)
  return COLORS[Math.abs(hash) % COLORS.length]!
}

export function PresenceIndicator({ rfpId, currentUserId, displayName }: PresenceIndicatorProps) {
  const [viewers, setViewers] = useState<PresenceEntry[]>([])
  const heartbeatRef = useRef<ReturnType<typeof setInterval> | null>(null)

  useEffect(() => {
    const fetchPresence = async () => {
      try {
        const res = await fetch(`/api/rfps/${rfpId}/presence`)
        if (res.ok) {
          const data = await res.json()
          setViewers((data.viewers as PresenceEntry[]).filter((v) => v.userId !== currentUserId))
        }
      } catch { /* ignore */ }
    }

    const sendHeartbeat = async () => {
      try {
        await fetch(`/api/rfps/${rfpId}/presence`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ displayName: displayName ?? currentUserId, color: colorForUser(currentUserId) }),
        })
      } catch { /* ignore */ }
    }

    // Initial heartbeat + fetch
    sendHeartbeat()
    fetchPresence()

    heartbeatRef.current = setInterval(() => {
      sendHeartbeat()
      fetchPresence()
    }, 10_000)

    return () => {
      if (heartbeatRef.current) clearInterval(heartbeatRef.current)
    }
  }, [rfpId, currentUserId, displayName])

  const MAX_VISIBLE = 5
  const visible = viewers.slice(0, MAX_VISIBLE)
  const overflow = viewers.length - MAX_VISIBLE

  if (viewers.length === 0) return null

  const names = viewers.map((v) => v.displayName).join(', ')

  return (
    <div
      className="flex items-center gap-1"
      aria-label={`Currently viewing: ${names}`}
      role="group"
    >
      {visible.map((viewer) => (
        <span
          key={viewer.userId}
          className="inline-flex h-7 w-7 items-center justify-center rounded-full text-xs font-medium text-white ring-2 ring-background"
          style={{ backgroundColor: viewer.color ?? colorForUser(viewer.userId) }}
          title={viewer.displayName}
          aria-label={viewer.displayName}
        >
          {viewer.displayName.charAt(0).toUpperCase()}
        </span>
      ))}
      {overflow > 0 && (
        <span
          className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-muted text-xs font-medium"
          aria-label={`${overflow} more viewers`}
        >
          +{overflow}
        </span>
      )}
    </div>
  )
}
