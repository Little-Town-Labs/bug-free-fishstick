'use client'

interface Contributor {
  userId: string
  displayName: string
  rfpsCompleted: number
}

interface TopContributorsProps {
  contributors: Contributor[]
  isAdmin: boolean
}

export function TopContributors({ contributors, isAdmin }: TopContributorsProps) {
  if (!isAdmin) return null

  if (contributors.length === 0) {
    return (
      <div className="text-sm text-muted-foreground">No completed RFPs yet.</div>
    )
  }

  return (
    <ol aria-label="Top contributors by RFPs completed" className="space-y-2">
      {contributors.map((c, i) => (
        <li key={c.userId} className="flex items-center justify-between text-sm">
          <span className="flex items-center gap-2">
            <span className="font-mono text-xs text-muted-foreground w-4">{i + 1}.</span>
            <span>{c.displayName}</span>
          </span>
          <span className="font-medium">{c.rfpsCompleted} RFPs</span>
        </li>
      ))}
    </ol>
  )
}
