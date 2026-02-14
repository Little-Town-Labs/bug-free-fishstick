'use client'

import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts'

interface VolumeDataPoint {
  date: string
  count: number
}

interface VolumeChartProps {
  data: VolumeDataPoint[]
}

export function VolumeChart({ data }: VolumeChartProps) {
  if (data.length === 0) {
    return (
      <div className="flex h-48 items-center justify-center text-sm text-muted-foreground">
        No volume data available
      </div>
    )
  }

  return (
    <div>
      {/* Accessible fallback table for screen readers */}
      <table className="sr-only" aria-label="RFP volume over time">
        <thead>
          <tr>
            <th scope="col">Date</th>
            <th scope="col">RFP Count</th>
          </tr>
        </thead>
        <tbody>
          {data.map((row) => (
            <tr key={row.date}>
              <td>{row.date}</td>
              <td>{row.count}</td>
            </tr>
          ))}
        </tbody>
      </table>

      {/* Visual chart */}
      <div aria-hidden="true" className="h-48 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} margin={{ top: 4, right: 4, bottom: 4, left: 4 }}>
            <XAxis dataKey="date" tick={{ fontSize: 11 }} />
            <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
            <Tooltip />
            <Bar dataKey="count" fill="hsl(var(--primary))" radius={[2, 2, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  )
}
