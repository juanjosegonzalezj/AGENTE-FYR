import {
  createReservation,
  cancelReservation as dbCancelReservation,
  updateReservation,
  getReservationById,
  checkCourtConflict,
} from '../../db/queries/reservations.js';
import { getCourtById } from '../../db/queries/courts.js';
import {
  createCalendarEvent,
  deleteCalendarEvent,
  updateCalendarEvent,
} from '../../integrations/google-calendar/events.js';
import type { Sport } from '../../types/index.js';
import logger from '../../utils/logger.js';

export interface CreateBookingInput {
  court_id: string;
  sport: Sport;
  starts_at: string;   // ISO datetime
  ends_at: string;     // ISO datetime
  player_name?: string;
  notes?: string;
}

export interface CancelBookingInput {
  reservation_id: string;
  reason?: string;
}

export interface RescheduleBookingInput {
  reservation_id: string;
  new_starts_at: string;
  new_ends_at: string;
}

export async function createBooking(
  complexId: string,
  playerId: string | null,
  input: CreateBookingInput
) {
  const { court_id, sport, starts_at, ends_at, player_name, notes } = input;

  // 1. Verify court exists and belongs to this complex
  const court = await getCourtById(court_id);
  if (!court || court.complex_id !== complexId) {
    return { success: false, error: 'Pista no encontrada.' };
  }

  // 2. Double-check availability (race condition guard)
  const hasConflict = await checkCourtConflict(court_id, starts_at, ends_at);
  if (hasConflict) {
    return {
      success: false,
      error: 'Lo sentimos, esa franja horaria ya está ocupada. Por favor elige otro horario.',
    };
  }

  const durationMs = new Date(ends_at).getTime() - new Date(starts_at).getTime();
  const durationMinutes = Math.round(durationMs / 60000);
  const hourlyRate = court.hourly_rate ?? 0;
  const totalPrice = (hourlyRate * durationMinutes) / 60;

  const title = player_name
    ? `${sport.charAt(0).toUpperCase() + sport.slice(1)} – ${player_name}`
    : `${sport.charAt(0).toUpperCase() + sport.slice(1)} – Reserva`;

  try {
    // 3. Create reservation in DB
    const reservation = await createReservation({
      complex_id: complexId,
      court_id,
      player_id: playerId ?? undefined,
      sport,
      starts_at,
      ends_at,
      duration_minutes: durationMinutes,
      title,
      total_price: totalPrice > 0 ? totalPrice : undefined,
      notes,
    });

    // 4. Create Google Calendar event (non-blocking — reservation is valid even if this fails)
    const eventId = await createCalendarEvent(court_id, {
      title,
      description: `Reserva ID: ${reservation.id}\nJugador: ${player_name ?? 'N/A'}\n${notes ?? ''}`,
      startsAt: starts_at,
      endsAt: ends_at,
      sport,
    });

    if (eventId) {
      await updateReservation(reservation.id, { google_event_id: eventId });
    }

    logger.info(`Booking created: ${reservation.id}`);

    const startLabel = new Date(starts_at).toLocaleString('es-ES', {
      weekday: 'long', day: 'numeric', month: 'long',
      hour: '2-digit', minute: '2-digit',
    });

    return {
      success: true,
      reservation_id: reservation.id,
      court_name: court.name,
      sport,
      starts_at,
      ends_at,
      start_label: startLabel,
      duration_minutes: durationMinutes,
      total_price: totalPrice > 0 ? `${totalPrice.toFixed(2)} ${court.currency}` : 'Incluido',
      message: `✅ Reserva confirmada en ${court.name} – ${startLabel}`,
    };
  } catch (err: any) {
    logger.error('createBooking failed', { err: err.message });
    return { success: false, error: err.message };
  }
}

export async function cancelBooking(
  complexId: string,
  input: CancelBookingInput
) {
  const { reservation_id, reason } = input;

  const reservation = await getReservationById(reservation_id);
  if (!reservation) {
    return { success: false, error: 'Reserva no encontrada.' };
  }
  if (reservation.complex_id !== complexId) {
    return { success: false, error: 'Sin autorización.' };
  }
  if (reservation.status === 'cancelled') {
    return { success: false, error: 'Esta reserva ya estaba cancelada.' };
  }

  // Delete Google Calendar event
  if (reservation.google_event_id) {
    await deleteCalendarEvent(reservation.court_id, reservation.google_event_id);
  }

  await dbCancelReservation(reservation_id, reason);

  logger.info(`Booking cancelled: ${reservation_id}`);

  return {
    success: true,
    reservation_id,
    message: `Reserva cancelada correctamente.${reason ? ` Motivo: ${reason}` : ''}`,
  };
}

export async function rescheduleBooking(
  complexId: string,
  input: RescheduleBookingInput
) {
  const { reservation_id, new_starts_at, new_ends_at } = input;

  const reservation = await getReservationById(reservation_id);
  if (!reservation) return { success: false, error: 'Reserva no encontrada.' };
  if (reservation.complex_id !== complexId) return { success: false, error: 'Sin autorización.' };
  if (reservation.status === 'cancelled') return { success: false, error: 'No se puede mover una reserva cancelada.' };

  // Check new slot is free
  const hasConflict = await checkCourtConflict(
    reservation.court_id,
    new_starts_at,
    new_ends_at,
    reservation_id
  );
  if (hasConflict) {
    return { success: false, error: 'El nuevo horario está ocupado. Por favor elige otro.' };
  }

  const durationMs = new Date(new_ends_at).getTime() - new Date(new_starts_at).getTime();
  const durationMinutes = Math.round(durationMs / 60000);

  // Update Google Calendar event
  if (reservation.google_event_id) {
    await updateCalendarEvent(reservation.court_id, reservation.google_event_id, {
      startsAt: new_starts_at,
      endsAt: new_ends_at,
    });
  }

  await updateReservation(reservation_id, {
    starts_at: new_starts_at,
    ends_at: new_ends_at,
    duration_minutes: durationMinutes,
  });

  const newLabel = new Date(new_starts_at).toLocaleString('es-ES', {
    weekday: 'long', day: 'numeric', month: 'long',
    hour: '2-digit', minute: '2-digit',
  });

  logger.info(`Booking rescheduled: ${reservation_id}`);

  return {
    success: true,
    reservation_id,
    new_starts_at,
    new_ends_at,
    message: `Reserva movida correctamente al ${newLabel}`,
  };
}

export async function getReservationDetails(reservationId: string, complexId: string) {
  const reservation = await getReservationById(reservationId);
  if (!reservation) return { found: false, error: 'Reserva no encontrada.' };
  if (reservation.complex_id !== complexId) return { found: false, error: 'Sin autorización.' };

  const startLabel = new Date(reservation.starts_at).toLocaleString('es-ES', {
    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });

  return {
    found: true,
    reservation_id: reservation.id,
    status: reservation.status,
    court_name: (reservation.court as any)?.name ?? 'N/A',
    sport: reservation.sport,
    starts_at: reservation.starts_at,
    ends_at: reservation.ends_at,
    start_label: startLabel,
    duration_minutes: reservation.duration_minutes,
    total_price: reservation.total_price,
    player_name: (reservation.player as any)?.full_name ?? 'N/A',
    notes: reservation.notes,
  };
}
