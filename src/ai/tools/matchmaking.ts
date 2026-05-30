import { searchPlayersForMatchmaking } from '../../db/queries/players.js';
import type { Sport, MatchmakingCandidate, Player, Gender } from '../../types/index.js';
import logger from '../../utils/logger.js';

export interface FindOpponentsInput {
  sport: Sport;
  preferred_date: string;
  time_start: string;
  time_end: string;
  skill_min?: number;
  skill_max?: number;
  gender_pref?: Gender;
  age_min?: number;
  age_max?: number;
}

// Calculates a 0-100 compatibility score between two players
function calculateCompatibility(requester: Player, candidate: Player): number {
  let score = 0;
  const reasons: string[] = [];

  // 1. Skill proximity (0–50 pts)
  const skillDiff = Math.abs(requester.skill_score - candidate.skill_score);
  const skillScore = Math.max(0, 50 - skillDiff / 10);
  score += skillScore;
  if (skillDiff < 50) reasons.push('Nivel de habilidad muy similar');
  else if (skillDiff < 150) reasons.push('Nivel de habilidad compatible');

  // 2. Activity (0–20 pts): recently active players ranked higher
  const matchCount = candidate.stats?.matches ?? 0;
  const activityScore = Math.min(20, matchCount * 2);
  score += activityScore;
  if (matchCount > 5) reasons.push('Jugador activo con experiencia');

  // 3. Win balance (0–15 pts)
  const reqWinRate = requester.stats.matches > 0
    ? requester.stats.wins / requester.stats.matches : 0.5;
  const canWinRate = candidate.stats.matches > 0
    ? candidate.stats.wins / candidate.stats.matches : 0.5;
  const winDiff = Math.abs(reqWinRate - canWinRate);
  const winScore = Math.max(0, 15 - winDiff * 30);
  score += winScore;

  // 4. Age compatibility (0–15 pts) — optional
  if (requester.age && candidate.age) {
    const ageDiff = Math.abs(requester.age - candidate.age);
    const ageScore = Math.max(0, 15 - ageDiff);
    score += ageScore;
    if (ageDiff < 5) reasons.push('Edad similar');
  } else {
    score += 7.5; // neutral when unknown
  }

  if (reasons.length === 0) reasons.push('Perfil compatible');

  return Math.round(Math.min(100, score));
}

export async function findOpponents(
  complexId: string,
  requesterId: string,
  input: FindOpponentsInput
): Promise<{
  found: boolean;
  opponents: MatchmakingCandidate[];
  message: string;
}> {
  const {
    sport, preferred_date, time_start, time_end,
    skill_min, skill_max, gender_pref, age_min, age_max,
  } = input;

  // Get the requester's profile
  const { getPlayerById } = await import('../../db/queries/players.js');
  const requester = await getPlayerById(requesterId);
  if (!requester) {
    return { found: false, opponents: [], message: 'Perfil de jugador no encontrado.' };
  }

  // Determine skill range (±200 by default)
  const effectiveSkillMin = skill_min ?? Math.max(0, requester.skill_score - 200);
  const effectiveSkillMax = skill_max ?? Math.min(1000, requester.skill_score + 200);

  const candidates = await searchPlayersForMatchmaking({
    complexId,
    sport,
    skillMin: effectiveSkillMin,
    skillMax: effectiveSkillMax,
    isLooking: true,
    excludeId: requesterId,
    gender: gender_pref,
    ageMin: age_min,
    ageMax: age_max,
    limit: 20,
  });

  if (!candidates.length) {
    return {
      found: false,
      opponents: [],
      message: `No se encontraron rivales disponibles para ${sport} en este momento. ¿Quieres que te avisemos cuando haya alguien disponible?`,
    };
  }

  // Calculate compatibility scores and sort
  const ranked: MatchmakingCandidate[] = candidates
    .map(candidate => ({
      player: candidate,
      score: calculateCompatibility(requester, candidate),
      reasons: [],
    }))
    .sort((a, b) => b.score - a.score)
    .slice(0, 5); // Return top 5

  logger.info(`findOpponents: found ${ranked.length} candidates`, { sport, complexId });

  // Build human-readable result
  const opponentSummaries = ranked.map((c, i) => ({
    rank: i + 1,
    player_id: c.player.id,
    name: c.player.full_name,
    sport: c.player.sport,
    skill_level: c.player.skill_level,
    skill_score: c.player.skill_score,
    compatibility_pct: c.score,
    stats: `${c.player.stats.wins}W / ${c.player.stats.losses}L`,
  }));

  return {
    found: true,
    opponents: ranked,
    message: `Encontré ${ranked.length} rivales compatibles para ${sport} el ${preferred_date} entre ${time_start} y ${time_end}.`,
    // @ts-ignore
    opponent_list: opponentSummaries,
  };
}
