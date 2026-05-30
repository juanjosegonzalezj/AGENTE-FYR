import { db } from '../client.js';
import type { Reservation, ReservationStatus, Sport } from '../../types/index.js';

export interface CreateReservationPayload {
  complex_id: string;
  court_id: string;
  player_id?: string;
  customer_id?: string;
  sport: Sport;
  starts_at: string;
  ends_at: string;
  duration_minutes: number;
  title?: string;
  player_count?: number;
  total_price?: number;
  notes?: string;
  google_event_id?: string;
}

export async function getReservationsByComplex(
  complexId: string,
  options?: {
    status?: ReservationStatus;
    courtId?: string;
    dateFrom?: string;
    dateTo?: string;
    limit?: number;
  }
): Promise<Reservation[]> {
  let query = db.client
    .from('reservations')
    .select('*, courts(name, sport)')
    .eq('complex_id', complexId)
    .order('starts_at', { ascending: true });

  if (options?.status) query = query.eq('status', options.status);
  if (options?.courtId) query = query.eq('court_id', options.courtId);
  if (options?.dateFrom) query = query.gte('starts_at', options.dateFrom);
  if (options?.dateTo) query = query.lte('starts_at', options.dateTo);
  if (options?.limit) query = query.limit(options.limit);

  const { data, error } = await query;
  if (error) throw new Error(`Failed to fetch reservations: ${error.message}`);
  return (data ?? []) as Reservation[];
}

export async function getReservationById(id: string): Promise<Reservation | null> {
  const { data, error } = await db.client
    .from('reservations')
    .select('*, courts(name, sport, complex_id), players(full_name, phone, email)')
    .eq('id', id)
    .single();

  if (error || !data) return null;
  return data as Reservation;
}

export async function getReservationsByPlayer(
  playerId: string,
  status?: ReservationStatus
): Promise<Reservation[]> {
  let query = db.client
    .from('reservations')
    .select('*, courts(name, sport)')
    .eq('player_id', playerId)
    .order('starts_at', { ascending: true });

  if (status) query = query.eq('status', status);

  const { data, error } = await query;
  if (error) throw new Error(`Failed to fetch player reservations: ${error.message}`);
  return (data ?? []) as Reservation[];
}

export async function checkCourtConflict(
  courtId: string,
  startsAt: string,
  endsAt: string,
  excludeId?: string
): Promise<boolean> {
  let query = db.client
    .from('reservations')
    .select('id')
    .eq('court_id', courtId)
    .neq('status', 'cancelled')
    .or(`starts_at.lt.${endsAt},ends_at.gt.${startsAt}`);

  if (excludeId) query = query.neq('id', excludeId);

  const { data, error } = await query;
  if (error) return false;
  return (data ?? []).length > 0;
}

export async function createReservation(
  payload: CreateReservationPayload
): Promise<Reservation> {
  // Double-check for conflicts before insert
  const hasConflict = await checkCourtConflict(
    payload.court_id,
    payload.starts_at,
    payload.ends_at
  );
  if (hasConflict) {
    throw new Error('Court is already booked for that time slot. Please choose another time.');
  }

  const { data, error } = await db.client
    .from('reservations')
    .insert({ ...payload, status: 'confirmed' })
    .select()
    .single();

  if (error) throw new Error(`Failed to create reservation: ${error.message}`);
  return data as Reservation;
}

export async function updateReservation(
  id: string,
  payload: Partial<Reservation>
): Promise<Reservation> {
  const { data, error } = await db.client
    .from('reservations')
    .update({ ...payload, updated_at: new Date().toISOString() })
    .eq('id', id)
    .select()
    .single();

  if (error) throw new Error(`Failed to update reservation: ${error.message}`);
  return data as Reservation;
}

export async function cancelReservation(
  id: string,
  reason?: string
): Promise<Reservation> {
  const { data, error } = await db.client
    .from('reservations')
    .update({
      status: 'cancelled',
      cancelled_at: new Date().toISOString(),
      notes: reason ?? null,
      updated_at: new Date().toISOString(),
    })
    .eq('id', id)
    .select()
    .single();

  if (error) throw new Error(`Failed to cancel reservation: ${error.message}`);
  return data as Reservation;
}

export async function getUpcomingReservationsForReminders(): Promise<Reservation[]> {
  const now = new Date();
  const oneHourFromNow = new Date(now.getTime() + 60 * 60 * 1000);
  const twoHoursFromNow = new Date(now.getTime() + 2 * 60 * 60 * 1000);

  const { data, error } = await db.client
    .from('reservations')
    .select('*, players(full_name, phone, whatsapp_id), courts(name)')
    .eq('status', 'confirmed')
    .eq('reminder_sent', false)
    .gte('starts_at', oneHourFromNow.toISOString())
    .lte('starts_at', twoHoursFromNow.toISOString());

  if (error) throw new Error(`Failed to fetch upcoming reservations: ${error.message}`);
  return (data ?? []) as Reservation[];
}

export async function markReminderSent(id: string): Promise<void> {
  await db.client
    .from('reservations')
    .update({ reminder_sent: true })
    .eq('id', id);
}
