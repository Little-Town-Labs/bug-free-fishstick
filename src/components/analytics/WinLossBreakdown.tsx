'use client'

import { BarChart, Bar, XAxis, YAxis, Tooltip, Legend, ResponsiveContainer } from 'recharts'

interface WinLossDataPoint {
  type: string
  won: number
  lost: number
}

interface WinLossBreakdownProps {
  data: WinLossDataPoint[]
}

export function WinLossBreakdown({ data }: WinLossBreakdownProps) {
  if (data.length === 0) {
    return (
      <div className="flex h-48 items-center justify-center text-sm text-muted-foreground">
        No outcome data available
      </div>
    )
  }

  return (
    <div>
      {/* Accessible fallback table */}
      <table className="sr-only" aria-label="Win/loss breakdown by RFP type">
        <thead>
          <tr>
            <th scope="col">RFP Type</th>
            <th scope="col">Won</th>
            <th scope="col">Lost</th>
          </tr>
        </thead>
        <tbody>
          {data.map((row) => (
            <tr key={row.type}>
              <td>{row.type}</td>
              <td>{row.won}</td>
              <td>{row.lost}</td>
            </tr>
          ))}
        </tbody>
      </table>

      {/* Visual chart */}
      <div aria-hidden="true" className="h-48 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} margin={{ top: 4, right: 4, bottom: 4, left: 4 }}>
            <XAxis dataKey="type" tick={{ fontSize: 11 }} />
            <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
            <Tooltip />
            <Legend />
            <Bar dataKey="won" name="Won" fill="hsl(var(--chart-1, 142 71% 45%))" radius={[2, 2, 0, 0]} />
            <Bar dataKey="lost" name="Lost" fill="hsl(var(--chart-2, 0 84% 60%))" radius={[2, 2, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  )
}
