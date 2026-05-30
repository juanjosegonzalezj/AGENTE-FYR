import { getPlayerById, getPlayerByPhone } from '../../db/queries/players.js';

export async function getPlayerProfile(playerId: string, complexId: string) {
  const player = await getPlayerById(playerId);
  if (!player) return { found: false, error: 'Jugador no encontrado.' };
  if (player.complex_id !== complexId) return { found: false, error: 'Sin autorización.' };

  return {
    found: true,
    id: player.id,
    full_name: player.full_name,
    sport: player.sport,
    skill_level: player.skill_level,
    skill_score: player.skill_score,
    age: player.age,
    gender: player.gender,
    is_looking_for_match: player.is_looking_for_match,
    stats: {
      matches: player.stats.matches,
      wins: player.stats.wins,
      losses: player.stats.losses,
      win_rate: player.stats.matches > 0
        ? `${Math.round((player.stats.wins / player.stats.matches) * 100)}%`
        : 'N/A',
    },
    preferred_times: player.preferred_times,
  };
}
