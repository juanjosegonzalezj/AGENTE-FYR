'use client';
import { useState } from 'react';
import { Plus, Edit2, Trash2, Wifi, WifiOff } from 'lucide-react';

const SPORT_EMOJI: Record<string, string> = {
  padel: '🎾', tennis: '🎾', soccer: '⚽', basketball: '🏀', volleyball: '🏐',
};

export default function CourtsClient({ courts, tenantId }: { courts: any[]; tenantId: string }) {
  const [showModal, setShowModal] = useState(false);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Pistas</h1>
          <p className="text-gray-500 text-sm mt-1">{courts.length} pistas activas</p>
        </div>
        <button onClick={() => setShowModal(true)} className="btn-primary flex items-center gap-2">
          <Plus size={16} /> Nueva pista
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        {courts.map(court => (
          <div key={court.id} className="card p-5 hover:shadow-md transition-shadow">
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 bg-gray-100 rounded-xl flex items-center justify-center text-2xl">
                  {SPORT_EMOJI[court.sport] ?? '🏟️'}
                </div>
                <div>
                  <h3 className="font-semibold text-gray-900">{court.name}</h3>
                  <p className="text-sm text-gray-500 capitalize">{court.sport} · {court.surface ?? 'N/A'}</p>
                </div>
              </div>
              <div className="flex gap-1">
                <button className="p-1.5 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-100">
                  <Edit2 size={14} />
                </button>
                <button className="p-1.5 text-gray-400 hover:text-red-600 rounded-lg hover:bg-red-50">
                  <Trash2 size={14} />
                </button>
              </div>
            </div>

            <div className="mt-4 grid grid-cols-2 gap-3 text-sm">
              <div className="bg-gray-50 rounded-lg px-3 py-2">
                <p className="text-gray-400 text-xs">Precio/hora</p>
                <p className="font-semibold text-gray-900">
                  {court.hourly_rate ? `€${court.hourly_rate}` : 'Gratis'}
                </p>
              </div>
              <div className="bg-gray-50 rounded-lg px-3 py-2">
                <p className="text-gray-400 text-xs">Tipo</p>
                <p className="font-semibold text-gray-900">{court.indoor ? 'Interior' : 'Exterior'}</p>
              </div>
            </div>

            {/* Calendar sync status */}
            <div className={`mt-3 flex items-center gap-2 text-xs ${court.google_calendar_id ? 'text-brand-600' : 'text-gray-400'}`}>
              {court.google_calendar_id ? <Wifi size={12} /> : <WifiOff size={12} />}
              {court.google_calendar_id ? 'Google Calendar sincronizado' : 'Sin calendario vinculado'}
            </div>
          </div>
        ))}

        {courts.length === 0 && (
          <div className="col-span-3 card p-12 text-center">
            <p className="text-gray-400 text-sm">No hay pistas configuradas.</p>
            <button onClick={() => setShowModal(true)} className="btn-primary mt-4">
              Añadir primera pista
            </button>
          </div>
        )}
      </div>

      {/* Simple add-court modal stub */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="card p-6 w-full max-w-md">
            <h2 className="text-lg font-semibold mb-4">Nueva Pista</h2>
            <p className="text-sm text-gray-500 mb-4">
              Configura los datos de la pista. Podrás vincular un Google Calendar después.
            </p>
            <div className="space-y-3">
              <input className="input" placeholder="Nombre (ej. Pádel 1)" />
              <select className="input">
                <option value="padel">Pádel</option>
                <option value="tennis">Tenis</option>
                <option value="soccer">Fútbol</option>
                <option value="basketball">Baloncesto</option>
              </select>
              <input className="input" type="number" placeholder="Precio por hora (€)" />
            </div>
            <div className="flex gap-3 mt-6">
              <button onClick={() => setShowModal(false)} className="btn-secondary flex-1">Cancelar</button>
              <button className="btn-primary flex-1">Guardar</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
