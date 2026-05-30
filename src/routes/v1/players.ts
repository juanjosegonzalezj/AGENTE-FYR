import { Router } from 'express';
import { z } from 'zod';
import {
  getPlayersByComplex,
  getPlayerById,
  createPlayer,
  updatePlayer,
  searchPlayersForMatchmaking,
} from '../../db/queries/players.js';
import type { Request, Response } from 'express';

const router = Router();

// GET /api/v1/players
router.get('/', async (req: Request, res: Response) => {
  try {
    const sport = Array.isArray(req.query.sport) ? String(req.query.sport[0]) : req.query.sport as string | undefined;
    const players = await getPlayersByComplex(req.tenantId!, sport as any);
    res.json({ success: true, data: players, total: players.length });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// GET /api/v1/players/matchmaking?sport=padel
router.get('/matchmaking', async (req: Request, res: Response) => {
  try {
    const sport = Array.isArray(req.query.sport) ? String(req.query.sport[0]) : req.query.sport as string;
    const skill_min = Array.isArray(req.query.skill_min) ? String(req.query.skill_min[0]) : req.query.skill_min as string;
    const skill_max = Array.isArray(req.query.skill_max) ? String(req.query.skill_max[0]) : req.query.skill_max as string;
    const gender = Array.isArray(req.query.gender) ? String(req.query.gender[0]) : req.query.gender as string;
    const limit = Array.isArray(req.query.limit) ? String(req.query.limit[0]) : req.query.limit as string;
    if (!sport) return res.status(400).json({ success: false, error: 'sport is required' });

    const players = await searchPlayersForMatchmaking({
      complexId: req.tenantId!,
      sport: sport as any,
      skillMin: skill_min ? Number(skill_min) : undefined,
      skillMax: skill_max ? Number(skill_max) : undefined,
      isLooking: true,
      gender,
      limit: limit ? Number(limit) : 10,
    });

    res.json({ success: true, data: players });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// GET /api/v1/players/:id
router.get('/:id', async (req: Request, res: Response) => {
  try {
    const player = await getPlayerById(String(req.params.id));
    if (!player || player.complex_id !== req.tenantId) {
      return res.status(404).json({ success: false, error: 'Player not found.' });
    }
    res.json({ success: true, data: player });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

const playerSchema = z.object({
  full_name: z.string().min(1),
  email: z.string().email().optional(),
  phone: z.string().optional(),
  sport: z.enum(['padel', 'tennis', 'soccer', 'basketball', 'volleyball']),
  skill_level: z.enum(['beginner', 'intermediate', 'advanced', 'professional']).default('intermediate'),
  skill_score: z.number().int().min(0).max(1000).default(500),
  age: z.number().int().min(1).max(120).optional(),
  gender: z.enum(['male', 'female', 'non_binary', 'any']).optional(),
  is_looking_for_match: z.boolean().default(false),
});

// POST /api/v1/players
router.post('/', async (req: Request, res: Response) => {
  try {
    const parsed = playerSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ success: false, error: parsed.error.flatten() });
    }
    const player = await createPlayer({ ...parsed.data, complex_id: req.tenantId });
    res.status(201).json({ success: true, data: player });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// PATCH /api/v1/players/:id
router.patch('/:id', async (req: Request, res: Response) => {
  try {
    const player = await getPlayerById(String(req.params.id));
    if (!player || player.complex_id !== req.tenantId) {
      return res.status(404).json({ success: false, error: 'Player not found.' });
    }
    const updated = await updatePlayer(String(req.params.id), req.body);
    res.json({ success: true, data: updated });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

export default router;
