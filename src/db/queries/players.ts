import { db } from '../client.js';
import type { Player, Sport, SkillLevel } from '../../types/index.js';

export async function getPlayersByComplex(complexId: string, sport?: Sport): Promise<Player[]> {
  let query = db.client
    .from('players')
    .select('*')
    .eq('complex_id', complexId)
    .eq('is_active', true)
    .order('full_name');

  if (sport) query = query.eq('sport', sport);

  const { data, error } = await query;
  if (error) throw new Error(`Failed to fetch players: ${error.message}`);
  return (data ?? []) as Player[];
}

export async function getPlayerById(id: string): Promise<Player | null> {
  const { data, error } = await db.client
    .from('players')
    .select('*')
    .eq('id', id)
    .single();

  if (error || !data) return null;
  return data as Player;
}

export async function getPlayerByPhone(phone: string, complexId?: string): Promise<Player | null> {
  let query = db.client
    .from('players')
    .select('*')
    .eq('phone', phone)
    .eq('is_active', true);

  if (complexId) query = query.eq('complex_id', complexId);

  const { data, error } = await query.single();
  if (error || !data) return null;
  return data as Player;
}

export async function getPlayerByWhatsappId(whatsappId: string): Promise<Player | null> {
  const { data, error } = await db.client
    .from('players')
    .select('*')
    .eq('whatsapp_id', whatsappId)
    .single();

  if (error || !data) return null;
  return data as Player;
}

export interface PlayerSearchFilters {
  complexId: string;
  sport: Sport;
  skillMin?: number;
  skillMax?: number;
  isLooking?: boolean;
  excludeId?: string;
  gender?: string;
  ageMin?: number;
  ageMax?: number;
  limit?: number;
}

export async function searchPlayersForMatchmaking(
  filters: PlayerSearchFilters
): Promise<Player[]> {
  const {
    complexId, sport, skillMin, skillMax,
    isLooking = true, excludeId, gender,
    ageMin, ageMax, limit = 10,
  } = filters;

  let query = db.client
    .from('players')
    .select('*')
    .eq('complex_id', complexId)
    .eq('sport', sport)
    .eq('is_active', true)
    .eq('is_looking_for_match', isLooking)
    .order('skill_score', { ascending: false })
    .limit(limit);

  if (skillMin !== undefined) query = query.gte('skill_score', skillMin);
  if (skillMax !== undefined) query = query.lte('skill_score', skillMax);
  if (excludeId) query = query.neq('id', excludeId);
  if (gender && gender !== 'any') query = query.or(`gender.eq.${gender},gender.eq.any,gender.is.null`);
  if (ageMin !== undefined) query = query.gte('age', ageMin);
  if (ageMax !== undefined) query = query.lte('age', ageMax);

  const { data, error } = await query;
  if (error) throw new Error(`Matchmaking query failed: ${error.message}`);
  return (data ?? []) as Player[];
}

export async function createPlayer(payload: Partial<Player>): Promise<Player> {
  const { data, error } = await db.client
    .from('players')
    .insert(payload)
    .select()
    .single();

  if (error) throw new Error(`Failed to create player: ${error.message}`);
  return data as Player;
}

export async function updatePlayer(id: string, payload: Partial<Player>): Promise<Player> {
  const { data, error } = await db.client
    .from('players')
    .update({ ...payload, updated_at: new Date().toISOString() })
    .eq('id', id)
    .select()
    .single();

  if (error) throw new Error(`Failed to update player: ${error.message}`);
  return data as Player;
}

export async function updatePlayerStats(
  id: string,
  result: 'win' | 'loss'
): Promise<void> {
  const player = await getPlayerById(id);
  if (!player) return;

  const stats = player.stats;
  const updatedStats = {
    matches: stats.matches + 1,
    wins: result === 'win' ? stats.wins + 1 : stats.wins,
    losses: result === 'loss' ? stats.losses + 1 : stats.losses,
  };

  // Simple ELO adjustment
  const delta = result === 'win' ? 25 : -20;
  const newScore = Math.max(0, Math.min(1000, player.skill_score + delta));

  await db.client
    .from('players')
    .update({ stats: updatedStats, skill_score: newScore, updated_at: new Date().toISOString() })
    .eq('id', id);
}
