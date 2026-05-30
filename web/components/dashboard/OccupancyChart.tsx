'use client';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts';

interface OccupancyRow {
  court_name: string;
  occupancy_pct: number;
  booked_slots: number;
  total_slots: number;
}

export default function OccupancyChart({ data }: { data: OccupancyRow[] }) {
  if (!data.length) {
    return <p className="text-gray-400 text-sm">No hay datos de ocupación disponibles.</p>;
  }

  const chartData = data.map(d => ({
    name: d.court_name,
    pct: Number(d.occupancy_pct ?? 0),
  }));

  return (
    <div>
      <ResponsiveContainer width="100%" height={220}>
        <BarChart data={chartData} margin={{ top: 0, right: 0, left: -20, bottom: 0 }}>
          <XAxis dataKey="name" tick={{ fontSize: 12 }} />
          <YAxis tick={{ fontSize: 12 }} domain={[0, 100]} unit="%" />
          <Tooltip formatter={(v: number) => [`${v.toFixed(1)}%`, 'Ocupación']} />
          <Bar dataKey="pct" radius={[4, 4, 0, 0]}>
            {chartData.map((entry, i) => (
              <Cell
                key={i}
                fill={entry.pct >= 70 ? '#16a34a' : entry.pct >= 40 ? '#3b82f6' : '#94a3b8'}
              />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>

      <div className="mt-4 space-y-2">
        {data.map(d => (
          <div key={d.court_name} className="flex items-center gap-3">
            <div className="flex-1">
              <div className="flex items-center justify-between text-sm mb-1">
                <span className="text-gray-700 font-medium">{d.court_name}</span>
                <span className="text-gray-500">{Number(d.occupancy_pct ?? 0).toFixed(1)}%</span>
              </div>
              <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                <div
                  className="h-full bg-brand-500 rounded-full"
                  style={{ width: `${Math.min(100, d.occupancy_pct)}%` }}
                />
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
