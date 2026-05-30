import { Router } from 'express';
import { z } from 'zod';
import {
  getReservationsByComplex,
  getReservationById,
  createReservation,
  cancelReservation,
  updateReservation,
} from '../../db/queries/reservations.js';
import {
  createCalendarEvent,
  deleteCalendarEvent,
  updateCalendarEvent,
} from '../../integrations/google-calendar/events.js';
import { getCourtById } from '../../db/queries/courts.js';
import type { Request, Response } from 'express';

const router = Router();

// GET /api/v1/reservations
router.get('/', async (req: Request, res: Response) => {
  try {
    const status = Array.isArray(req.query.status) ? String(req.query.status[0]) : req.query.status as string;
    const court_id = Array.isArray(req.query.court_id) ? String(req.query.court_id[0]) : req.query.court_id as string;
    const date_from = Array.isArray(req.query.date_from) ? String(req.query.date_from[0]) : req.query.date_from as string;
    const date_to = Array.isArray(req.query.date_to) ? String(req.query.date_to[0]) : req.query.date_to as string;
    const limit = Array.isArray(req.query.limit) ? String(req.query.limit[0]) : req.query.limit as string;
    const reservations = await getReservationsByComplex(req.tenantId!, {
      status: status as any,
      courtId: court_id,
      dateFrom: date_from,
      dateTo: date_to,
      limit: limit ? Number(limit) : 50,
    });
    res.json({ success: true, data: reservations, total: reservations.length });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// GET /api/v1/reservations/:id
router.get('/:id', async (req: Request, res: Response) => {
  try {
    const reservation = await getReservationById(String(req.params.id));
    if (!reservation || reservation.complex_id !== req.tenantId) {
      return res.status(404).json({ success: false, error: 'Reservation not found.' });
    }
    res.json({ success: true, data: reservation });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

const createSchema = z.object({
  court_id: z.string().uuid(),
  sport: z.enum(['padel', 'tennis', 'soccer', 'basketball', 'volleyball']),
  starts_at: z.string().datetime(),
  ends_at: z.string().datetime(),
  player_id: z.string().uuid().optional(),
  title: z.string().optional(),
  player_count: z.number().int().min(1).max(30).default(2),
  total_price: z.number().positive().optional(),
  notes: z.string().optional(),
});

// POST /api/v1/reservations
router.post('/', async (req: Request, res: Response) => {
  try {
    const parsed = createSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ success: false, error: parsed.error.flatten() });
    }

    const { starts_at, ends_at } = parsed.data;
    const durationMinutes = Math.round(
      (new Date(ends_at).getTime() - new Date(starts_at).getTime()) / 60000
    );

    const reservation = await createReservation({
      ...parsed.data,
      complex_id: req.tenantId!,
      duration_minutes: durationMinutes,
    });

    // Create Google Calendar event asynchronously
    const court = await getCourtById(parsed.data.court_id);
    if (court) {
      const eventId = await createCalendarEvent(court.id, {
        title: parsed.data.title ?? `${parsed.data.sport} – Reserva`,
        startsAt: starts_at,
        endsAt: ends_at,
        sport: parsed.data.sport,
      });
      if (eventId) {
        await updateReservation(reservation.id, { google_event_id: eventId });
      }
    }

    res.status(201).json({ success: true, data: reservation });
  } catch (err: any) {
    res.status(err.message.includes('already booked') ? 409 : 500)
       .json({ success: false, error: err.message });
  }
});

// PATCH /api/v1/reservations/:id
router.patch('/:id', async (req: Request, res: Response) => {
  try {
    const reservation = await getReservationById(String(req.params.id));
    if (!reservation || reservation.complex_id !== req.tenantId) {
      return res.status(404).json({ success: false, error: 'Reservation not found.' });
    }

    const updated = await updateReservation(String(req.params.id), req.body);

    // Sync Google Calendar if time changed
    if ((req.body.starts_at || req.body.ends_at) && reservation.google_event_id) {
      await updateCalendarEvent(reservation.court_id, reservation.google_event_id, {
        startsAt: req.body.starts_at ?? reservation.starts_at,
        endsAt: req.body.ends_at ?? reservation.ends_at,
      });
    }

    res.json({ success: true, data: updated });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// DELETE /api/v1/reservations/:id
router.delete('/:id', async (req: Request, res: Response) => {
  try {
    const reservation = await getReservationById(String(req.params.id));
    if (!reservation || reservation.complex_id !== req.tenantId) {
      return res.status(404).json({ success: false, error: 'Reservation not found.' });
    }

    if (reservation.google_event_id) {
      await deleteCalendarEvent(reservation.court_id, reservation.google_event_id);
    }

    const cancelled = await cancelReservation(String(req.params.id), req.body.reason);
    res.json({ success: true, data: cancelled });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

export default router;
