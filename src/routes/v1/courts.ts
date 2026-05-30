import { Router } from 'express';
import { z } from 'zod';
import {
  getCourtsByComplex,
  getCourtById,
  createCourt,
  updateCourt,
  deleteCourt,
} from '../../db/queries/courts.js';
import { getCourtAvailability } from '../../integrations/google-calendar/availability.js';
import type { Request, Response } from 'express';

const router = Router();

// GET /api/v1/courts
router.get('/', async (req: Request, res: Response) => {
  try {
    const sport = Array.isArray(req.query.sport) ? req.query.sport[0] as string : req.query.sport as string | undefined;
    const courts = await getCourtsByComplex(req.tenantId!, sport as any);
    res.json({ success: true, data: courts });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// GET /api/v1/courts/:id
router.get('/:id', async (req: Request, res: Response) => {
  try {
    const court = await getCourtById(String(req.params.id));
    if (!court || court.complex_id !== req.tenantId) {
      return res.status(404).json({ success: false, error: 'Court not found.' });
    }
    res.json({ success: true, data: court });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// GET /api/v1/courts/:id/availability?date=2026-06-15
router.get('/:id/availability', async (req: Request, res: Response) => {
  try {
    const court = await getCourtById(String(req.params.id));
    if (!court || court.complex_id !== req.tenantId) {
      return res.status(404).json({ success: false, error: 'Court not found.' });
    }

    const date = Array.isArray(req.query.date) ? String(req.query.date[0]) : (req.query.date as string ?? new Date().toISOString().split('T')[0]);
    const slots = await getCourtAvailability(
      court.id,
      date,
      req.tenantId!,
      req.complex?.timezone ?? 'Europe/Madrid'
    );

    res.json({ success: true, data: { court_id: court.id, court_name: court.name, date, slots } });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

const createSchema = z.object({
  name: z.string().min(1),
  sport: z.enum(['padel', 'tennis', 'soccer', 'basketball', 'volleyball']),
  surface: z.string().optional(),
  indoor: z.boolean().default(false),
  capacity: z.number().int().min(1).max(30).default(2),
  hourly_rate: z.number().positive().optional(),
  currency: z.string().default('EUR'),
  amenities: z.array(z.string()).default([]),
});

// POST /api/v1/courts
router.post('/', async (req: Request, res: Response) => {
  try {
    const parsed = createSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ success: false, error: parsed.error.flatten() });
    }
    const court = await createCourt({ ...parsed.data, complex_id: req.tenantId });
    res.status(201).json({ success: true, data: court });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// PATCH /api/v1/courts/:id
router.patch('/:id', async (req: Request, res: Response) => {
  try {
    const court = await getCourtById(String(req.params.id));
    if (!court || court.complex_id !== req.tenantId) {
      return res.status(404).json({ success: false, error: 'Court not found.' });
    }
    const updated = await updateCourt(String(req.params.id), req.body);
    res.json({ success: true, data: updated });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// DELETE /api/v1/courts/:id
router.delete('/:id', async (req: Request, res: Response) => {
  try {
    const court = await getCourtById(String(req.params.id));
    if (!court || court.complex_id !== req.tenantId) {
      return res.status(404).json({ success: false, error: 'Court not found.' });
    }
    await deleteCourt(String(req.params.id));
    res.json({ success: true, message: 'Court deactivated.' });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

export default router;
