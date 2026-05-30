import { getCalendarClient } from './client.js';
import { getCourtCalendar } from '../../db/queries/courts.js';
import { db } from '../../db/client.js';
import type { AvailabilitySlot, CourtAvailability } from '../../types/index.js';
import logger from '../../utils/logger.js';

// Operating hours
const OPEN_HOUR  = 8;   // 08:00
const CLOSE_HOUR = 23;  // 23:00
const SLOT_MINUTES = 60;

// Check Redis-like cache in Supabase availability table (TTL: 10 min)
async function getCachedSlots(
  courtId: string,
  date: string
): Promise<AvailabilitySlot[] | null> {
  const { data } = await db.client
    .from('availability')
    .select('slots, last_synced_at')
    .eq('court_id', courtId)
    .eq('date', date)
    .single();

  if (!data) return null;

  const age = Date.now() - new Date(data.last_synced_at).getTime();
  if (age > 10 * 60 * 1000) return null; // expired

  return data.slots as AvailabilitySlot[];
}

async function cacheSlots(
  complexId: string,
  courtId: string,
  date: string,
  slots: AvailabilitySlot[]
): Promise<void> {
  await db.client.from('availability').upsert(
    { complex_id: complexId, court_id: courtId, date, slots, last_synced_at: new Date().toISOString() },
    { onConflict: 'court_id,date' }
  );
}

function generateSlots(
  date: string,
  busyPeriods: Array<{ start: string; end: string }>,
  timezone: string
): AvailabilitySlot[] {
  const slots: AvailabilitySlot[] = [];
  const dateObj = new Date(`${date}T00:00:00`);

  for (let hour = OPEN_HOUR; hour < CLOSE_HOUR; hour++) {
    const slotStart = new Date(dateObj);
    slotStart.setHours(hour, 0, 0, 0);
    const slotEnd = new Date(slotStart.getTime() + SLOT_MINUTES * 60 * 1000);

    const isBusy = busyPeriods.some(busy => {
      const busyStart = new Date(busy.start);
      const busyEnd = new Date(busy.end);
      return slotStart < busyEnd && slotEnd > busyStart;
    });

    slots.push({
      start: slotStart.toISOString(),
      end: slotEnd.toISOString(),
      available: !isBusy,
      duration_minutes: SLOT_MINUTES,
    });
  }

  return slots;
}

export async function getCourtAvailability(
  courtId: string,
  date: string,
  complexId: string,
  timezone: string = 'Europe/Madrid'
): Promise<AvailabilitySlot[]> {
  // 1. Check cache
  const cached = await getCachedSlots(courtId, date);
  if (cached) {
    logger.debug(`Availability cache hit: court=${courtId} date=${date}`);
    return cached;
  }

  // 2. Fetch from Google Calendar
  const calRecord = await getCourtCalendar(courtId);
  if (!calRecord) {
    // No calendar linked — return slots based on DB reservations only
    return getSlotsFromDb(courtId, date, complexId, timezone);
  }

  const calClient = await getCalendarClient(courtId);
  if (!calClient) {
    return getSlotsFromDb(courtId, date, complexId, timezone);
  }

  try {
    const dayStart = new Date(`${date}T00:00:00`);
    const dayEnd   = new Date(`${date}T23:59:59`);

    const response = await calClient.freebusy.query({
      requestBody: {
        timeMin: dayStart.toISOString(),
        timeMax: dayEnd.toISOString(),
        timeZone: timezone,
        items: [{ id: calRecord.google_calendar_id }],
      },
    });

    const busyPeriods = response.data.calendars?.[calRecord.google_calendar_id]?.busy ?? [];
    const mappedBusy = busyPeriods.map(b => ({
      start: b.start ?? '',
      end: b.end ?? '',
    }));

    const slots = generateSlots(date, mappedBusy, timezone);
    await cacheSlots(complexId, courtId, date, slots);
    return slots;
  } catch (err) {
    logger.error('Google Calendar freebusy query failed', { courtId, date, err });
    return getSlotsFromDb(courtId, date, complexId, timezone);
  }
}

// Fallback: derive availability from DB reservations
async function getSlotsFromDb(
  courtId: string,
  date: string,
  complexId: string,
  timezone: string
): Promise<AvailabilitySlot[]> {
  const { data: reservations } = await db.client
    .from('reservations')
    .select('starts_at, ends_at')
    .eq('court_id', courtId)
    .eq('status', 'confirmed')
    .gte('starts_at', `${date}T00:00:00`)
    .lte('ends_at', `${date}T23:59:59`);

  const busy = (reservations ?? []).map(r => ({ start: r.starts_at, end: r.ends_at }));
  const slots = generateSlots(date, busy, timezone);
  await cacheSlots(complexId, courtId, date, slots);
  return slots;
}

export async function getMultiCourtAvailability(
  courts: Array<{ id: string; name: string; sport: string }>,
  date: string,
  complexId: string,
  timezone: string
): Promise<CourtAvailability[]> {
  const results = await Promise.all(
    courts.map(async court => {
      const slots = await getCourtAvailability(court.id, date, complexId, timezone);
      return {
        court_id: court.id,
        court_name: court.name,
        sport: court.sport as any,
        date,
        slots,
      };
    })
  );
  return results;
}
