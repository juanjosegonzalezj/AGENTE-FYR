import { getCourtsByComplex } from '../../db/queries/courts.js';
import { getMultiCourtAvailability } from '../../integrations/google-calendar/availability.js';
import type { Sport } from '../../types/index.js';
import logger from '../../utils/logger.js';

export interface GetAvailableCourtsInput {
  sport?: Sport;
  date: string;          // YYYY-MM-DD
  time_start?: string;   // HH:MM
  time_end?: string;     // HH:MM
  duration_minutes?: number;
}

export async function getAvailableCourts(
  complexId: string,
  timezone: string,
  input: GetAvailableCourtsInput
) {
  const { sport, date, time_start, time_end, duration_minutes = 60 } = input;

  // 1. Get courts for this complex (optionally filtered by sport)
  const courts = await getCourtsByComplex(complexId, sport);
  if (!courts.length) {
    return { available: false, message: 'No hay pistas disponibles para este deporte.', courts: [] };
  }

  // 2. Get availability from Google Calendar for all courts
  const availability = await getMultiCourtAvailability(courts, date, complexId, timezone);

  // 3. Filter slots by requested time window
  const results = availability.map(courtAvail => {
    let slots = courtAvail.slots.filter(s => s.available);

    if (time_start) {
      slots = slots.filter(s => {
        const slotHour = new Date(s.start).toLocaleTimeString('es-ES', {
          hour: '2-digit', minute: '2-digit', timeZone: timezone,
        });
        return slotHour >= time_start;
      });
    }
    if (time_end) {
      slots = slots.filter(s => {
        const slotEnd = new Date(s.end).toLocaleTimeString('es-ES', {
          hour: '2-digit', minute: '2-digit', timeZone: timezone,
        });
        return slotEnd <= time_end;
      });
    }

    const court = courts.find(c => c.id === courtAvail.court_id);

    return {
      court_id: courtAvail.court_id,
      court_name: courtAvail.court_name,
      sport: courtAvail.sport,
      indoor: court?.indoor ?? false,
      hourly_rate: court?.hourly_rate,
      currency: court?.currency ?? 'EUR',
      available_slots: slots.map(s => ({
        start: s.start,
        end: s.end,
        time_label: new Date(s.start).toLocaleTimeString('es-ES', {
          hour: '2-digit', minute: '2-digit', timeZone: timezone,
        }),
      })),
    };
  }).filter(c => c.available_slots.length > 0);

  logger.debug(`getAvailableCourts: ${results.length} courts with availability`, { date, sport });

  return {
    date,
    sport: sport ?? 'all',
    available_courts: results,
    total_available: results.reduce((sum, c) => sum + c.available_slots.length, 0),
  };
}
