import { db } from '../client.js';
import type { Court, CourtCalendar, Sport } from '../../types/index.js';

export async function getCourtsByComplex(complexId: string, sport?: Sport): Promise<Court[]> {
  let query = db.client
    .from('courts')
    .select('*')
    .eq('complex_id', complexId)
    .eq('is_active', true)
    .order('name');

  if (sport) query = query.eq('sport', sport);

  const { data, error } = await query;
  if (error) throw new Error(`Failed to fetch courts: ${error.message}`);
  return (data ?? []) as Court[];
}

export async function getCourtById(id: string): Promise<Court | null> {
  const { data, error } = await db.client
    .from('courts')
    .select('*')
    .eq('id', id)
    .single();

  if (error || !data) return null;
  return data as Court;
}

export async function createCourt(payload: Partial<Court>): Promise<Court> {
  const { data, error } = await db.client
    .from('courts')
    .insert(payload)
    .select()
    .single();

  if (error) throw new Error(`Failed to create court: ${error.message}`);
  return data as Court;
}

export async function updateCourt(id: string, payload: Partial<Court>): Promise<Court> {
  const { data, error } = await db.client
    .from('courts')
    .update({ ...payload, updated_at: new Date().toISOString() })
    .eq('id', id)
    .select()
    .single();

  if (error) throw new Error(`Failed to update court: ${error.message}`);
  return data as Court;
}

export async function deleteCourt(id: string): Promise<void> {
  const { error } = await db.client
    .from('courts')
    .update({ is_active: false, updated_at: new Date().toISOString() })
    .eq('id', id);

  if (error) throw new Error(`Failed to deactivate court: ${error.message}`);
}

// ── Calendar Integration ──────────────────────────────────────────────────────

export async function getCourtCalendar(courtId: string): Promise<CourtCalendar | null> {
  const { data, error } = await db.client
    .from('court_calendars')
    .select('*')
    .eq('court_id', courtId)
    .eq('is_active', true)
    .single();

  if (error || !data) return null;
  return data as CourtCalendar;
}

export async function getCalendarsByComplex(complexId: string): Promise<CourtCalendar[]> {
  const { data, error } = await db.client
    .from('court_calendars')
    .select('*, courts(name, sport)')
    .eq('complex_id', complexId)
    .eq('is_active', true);

  if (error) throw new Error(`Failed to fetch calendars: ${error.message}`);
  return (data ?? []) as CourtCalendar[];
}

export async function upsertCourtCalendar(payload: Partial<CourtCalendar>): Promise<CourtCalendar> {
  const { data, error } = await db.client
    .from('court_calendars')
    .upsert({ ...payload, updated_at: new Date().toISOString() }, { onConflict: 'court_id' })
    .select()
    .single();

  if (error) throw new Error(`Failed to upsert court calendar: ${error.message}`);
  return data as CourtCalendar;
}
