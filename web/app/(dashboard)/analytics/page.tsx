import { api } from '@/lib/api';
import OccupancyChart from '@/components/dashboard/OccupancyChart';

const TENANT_ID = process.env.DEMO_TENANT_ID ?? 'a1b2c3d4-e5f6-7890-abcd-ef1234567890';

async function getOccupancy() {
  const monthStart = new Date().toISOString().slice(0, 7) + '-01';
  const today = new Date().toISOString().slice(0, 10);
  try {
    const res = await api.get<{ success: boolean; data: any[] }>(
      `/api/v1/analytics/occupancy?date_from=${monthStart}&date_to=${today}`,
      { tenantId: TENANT_ID, cache: 'no-store' }
    );
    return res.data ?? [];
  } catch { return []; }
}

async function getRevenue() {
  const monthStart = new Date().toISOString().slice(0, 7) + '-01';
  const today = new Date().toISOString().slice(0, 10);
  try {
    const res = await api.get<{ success: boolean; data: any[] }>(
      `/api/v1/analytics/revenue?date_from=${monthStart}&date_to=${today}`,
      { tenantId: TENANT_ID, cache: 'no-store' }
    );
    return res.data ?? [];
  } catch { return []; }
}

export default async function AnalyticsPage() {
  const [occupancy, revenue] = await Promise.all([getOccupancy(), getRevenue()]);

  const totalRevenue = revenue.reduce((s: number, r: any) => s + (r.total_revenue ?? 0), 0);
  const totalBookings = revenue.reduce((s: number, r: any) => s + Number(r.total_bookings ?? 0), 0);
  const avgOccupancy = occupancy.length
    ? occupancy.reduce((s: number, c: any) => s + Number(c.occupancy_pct ?? 0), 0) / occupancy.length
    : 0;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Analíticas</h1>
        <p className="text-gray-500 text-sm mt-1">Datos del mes en curso</p>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {[
          { label: 'Ingresos del mes', value: `€${totalRevenue.toFixed(2)}` },
          { label: 'Reservas del mes', value: totalBookings },
          { label: 'Ocupación media', value: `${avgOccupancy.toFixed(1)}%` },
        ].map(({ label, value }) => (
          <div key={label} className="card p-5">
            <p className="text-sm text-gray-500">{label}</p>
            <p className="text-2xl font-bold text-gray-900 mt-1">{value}</p>
          </div>
        ))}
      </div>

      {/* Occupancy by court */}
      <div className="card p-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Ocupación por Pista</h2>
        <OccupancyChart data={occupancy} />
      </div>
    </div>
  );
}
