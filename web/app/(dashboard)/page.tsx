import { api } from '@/lib/api';
import { Calendar, Users, Trophy, TrendingUp } from 'lucide-react';

const TENANT_ID = process.env.DEMO_TENANT_ID ?? 'a1b2c3d4-e5f6-7890-abcd-ef1234567890';

async function getSummary() {
  try {
    const res = await api.get<{ success: boolean; data: any }>(
      '/api/v1/analytics/summary',
      { tenantId: TENANT_ID, cache: 'no-store' }
    );
    return res.data;
  } catch {
    return { total_courts: 0, total_players: 0, bookings_today: 0, revenue_this_month: 0 };
  }
}

async function getUpcomingReservations() {
  const today = new Date().toISOString().slice(0, 10);
  try {
    const res = await api.get<{ success: boolean; data: any[] }>(
      `/api/v1/reservations?status=confirmed&date_from=${today}&limit=5`,
      { tenantId: TENANT_ID, cache: 'no-store' }
    );
    return res.data ?? [];
  } catch {
    return [];
  }
}

export default async function DashboardPage() {
  const [summary, reservations] = await Promise.all([getSummary(), getUpcomingReservations()]);

  const stats = [
    { label: 'Pistas activas',     value: summary.total_courts,    icon: Trophy,     color: 'bg-blue-50 text-blue-700' },
    { label: 'Jugadores',          value: summary.total_players,   icon: Users,      color: 'bg-purple-50 text-purple-700' },
    { label: 'Reservas hoy',       value: summary.bookings_today,  icon: Calendar,   color: 'bg-brand-50 text-brand-700' },
    { label: 'Ingresos mes',       value: `€${(summary.revenue_this_month ?? 0).toFixed(0)}`, icon: TrendingUp, color: 'bg-orange-50 text-orange-700' },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Resumen</h1>
        <p className="text-gray-500 text-sm mt-1">
          {new Date().toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
        </p>
      </div>

      {/* Stats grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {stats.map(({ label, value, icon: Icon, color }) => (
          <div key={label} className="card p-5">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-500">{label}</p>
                <p className="text-2xl font-bold text-gray-900 mt-1">{value}</p>
              </div>
              <div className={`w-11 h-11 rounded-xl flex items-center justify-center ${color}`}>
                <Icon size={22} />
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Upcoming reservations */}
      <div className="card p-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Próximas Reservas</h2>
        {reservations.length === 0 ? (
          <p className="text-gray-400 text-sm">No hay reservas confirmadas para hoy.</p>
        ) : (
          <div className="divide-y divide-gray-100">
            {reservations.map((r: any) => (
              <div key={r.id} className="py-3 flex items-center justify-between">
                <div>
                  <p className="font-medium text-gray-900">{r.title ?? `${r.sport} – Reserva`}</p>
                  <p className="text-sm text-gray-500">
                    {r.courts?.name ?? 'Pista'} · {new Date(r.starts_at).toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })} – {new Date(r.ends_at).toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })}
                  </p>
                </div>
                <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-brand-50 text-brand-700">
                  {r.sport}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
