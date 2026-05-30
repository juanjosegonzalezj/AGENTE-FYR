import { api } from '@/lib/api';

const TENANT_ID = process.env.DEMO_TENANT_ID ?? 'a1b2c3d4-e5f6-7890-abcd-ef1234567890';

async function getReservations() {
  const today = new Date().toISOString().slice(0, 10);
  try {
    const res = await api.get<{ success: boolean; data: any[] }>(
      `/api/v1/reservations?status=confirmed&date_from=${today}&limit=20`,
      { tenantId: TENANT_ID, cache: 'no-store' }
    );
    return res.data ?? [];
  } catch {
    return [];
  }
}

const STATUS_COLORS: Record<string, string> = {
  confirmed: 'bg-green-50 text-green-700',
  pending:   'bg-yellow-50 text-yellow-700',
  cancelled: 'bg-red-50 text-red-700',
  no_show:   'bg-gray-50 text-gray-500',
};

export default async function ReservationsPage() {
  const reservations = await getReservations();

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Reservas</h1>
          <p className="text-gray-500 text-sm mt-1">{reservations.length} reservas confirmadas a partir de hoy</p>
        </div>
      </div>

      <div className="card overflow-hidden">
        <table className="w-full">
          <thead className="bg-gray-50 border-b border-gray-200">
            <tr>
              {['Pista', 'Deporte', 'Inicio', 'Duración', 'Precio', 'Estado'].map(h => (
                <th key={h} className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {reservations.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-gray-400 text-sm">
                  No hay reservas confirmadas para hoy.
                </td>
              </tr>
            ) : (
              reservations.map((r: any) => (
                <tr key={r.id} className="hover:bg-gray-50 transition-colors">
                  <td className="px-4 py-3 text-sm font-medium text-gray-900">
                    {r.courts?.name ?? 'N/A'}
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-600 capitalize">{r.sport}</td>
                  <td className="px-4 py-3 text-sm text-gray-600">
                    {new Date(r.starts_at).toLocaleString('es-ES', {
                      day: '2-digit', month: '2-digit',
                      hour: '2-digit', minute: '2-digit',
                    })}
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-600">{r.duration_minutes} min</td>
                  <td className="px-4 py-3 text-sm text-gray-600">
                    {r.total_price ? `€${r.total_price}` : '–'}
                  </td>
                  <td className="px-4 py-3">
                    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_COLORS[r.status] ?? ''}`}>
                      {r.status}
                    </span>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
