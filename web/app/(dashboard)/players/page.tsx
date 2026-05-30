import { api } from '@/lib/api';
import { Users, Star } from 'lucide-react';

const TENANT_ID = process.env.DEMO_TENANT_ID ?? 'a1b2c3d4-e5f6-7890-abcd-ef1234567890';

async function getPlayers() {
  try {
    const res = await api.get<{ success: boolean; data: any[] }>(
      '/api/v1/players',
      { tenantId: TENANT_ID, cache: 'no-store' }
    );
    return res.data ?? [];
  } catch {
    return [];
  }
}

const LEVEL_COLORS: Record<string, string> = {
  beginner:     'bg-gray-100 text-gray-700',
  intermediate: 'bg-blue-50 text-blue-700',
  advanced:     'bg-purple-50 text-purple-700',
  professional: 'bg-brand-50 text-brand-700',
};

export default async function PlayersPage() {
  const players = await getPlayers();

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Jugadores</h1>
          <p className="text-gray-500 text-sm mt-1">{players.length} jugadores registrados</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        {players.map((player: any) => (
          <div key={player.id} className="card p-5 hover:shadow-md transition-shadow">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 bg-gradient-to-br from-brand-400 to-brand-600 rounded-full flex items-center justify-center text-white font-bold text-lg">
                {player.full_name.charAt(0).toUpperCase()}
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-semibold text-gray-900 truncate">{player.full_name}</p>
                <p className="text-xs text-gray-500 capitalize">{player.sport}</p>
              </div>
              <span className={`text-xs font-medium px-2 py-1 rounded-full ${LEVEL_COLORS[player.skill_level] ?? ''}`}>
                {player.skill_level}
              </span>
            </div>

            <div className="mt-4 grid grid-cols-3 gap-2 text-center">
              <div className="bg-gray-50 rounded-lg py-2">
                <p className="text-lg font-bold text-gray-900">{player.stats?.matches ?? 0}</p>
                <p className="text-xs text-gray-400">Partidos</p>
              </div>
              <div className="bg-gray-50 rounded-lg py-2">
                <p className="text-lg font-bold text-brand-600">{player.stats?.wins ?? 0}</p>
                <p className="text-xs text-gray-400">Victorias</p>
              </div>
              <div className="bg-gray-50 rounded-lg py-2">
                <p className="text-lg font-bold text-gray-900">{player.skill_score}</p>
                <p className="text-xs text-gray-400">Puntuación</p>
              </div>
            </div>

            {player.is_looking_for_match && (
              <div className="mt-3 flex items-center gap-1.5 text-xs text-brand-600 font-medium">
                <Star size={12} fill="currentColor" />
                Buscando rival
              </div>
            )}
          </div>
        ))}

        {players.length === 0 && (
          <div className="col-span-3 card p-12 text-center">
            <Users size={40} className="text-gray-300 mx-auto mb-3" />
            <p className="text-gray-400 text-sm">No hay jugadores registrados aún.</p>
          </div>
        )}
      </div>
    </div>
  );
}
