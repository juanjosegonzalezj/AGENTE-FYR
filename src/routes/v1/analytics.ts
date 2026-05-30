import { Router } from 'express';
import { db } from '../../db/client.js';
import type { Request, Response } from 'express';

const router = Router();

// GET /api/v1/analytics/occupancy?date_from=2026-06-01&date_to=2026-06-30
router.get('/occupancy', async (req: Request, res: Response) => {
  try {
    const dateFrom = (req.query.date_from as string) ?? new Date().toISOString().slice(0, 7) + '-01';
    const dateTo = (req.query.date_to as string) ?? new Date().toISOString().slice(0, 10);

    const { data, error } = await db.client.rpc('get_occupancy_rate', {
      p_complex_id: req.tenantId,
      p_date_from: dateFrom,
      p_date_to: dateTo,
    });

    if (error) throw new Error(error.message);
    res.json({ success: true, data });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// GET /api/v1/analytics/revenue?date_from=2026-06-01&date_to=2026-06-30
router.get('/revenue', async (req: Request, res: Response) => {
  try {
    const dateFrom = (req.query.date_from as string) ?? new Date().toISOString().slice(0, 7) + '-01';
    const dateTo = (req.query.date_to as string) ?? new Date().toISOString().slice(0, 10);

    const { data, error } = await db.client.rpc('get_revenue_summary', {
      p_complex_id: req.tenantId,
      p_date_from: dateFrom,
      p_date_to: dateTo,
    });

    if (error) throw new Error(error.message);
    res.json({ success: true, data });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// GET /api/v1/analytics/summary
router.get('/summary', async (req: Request, res: Response) => {
  try {
    const today = new Date().toISOString().slice(0, 10);
    const monthStart = today.slice(0, 7) + '-01';

    const [courtsRes, playersRes, todayRes, monthRes] = await Promise.all([
      db.client.from('courts').select('id', { count: 'exact', head: true })
        .eq('complex_id', req.tenantId).eq('is_active', true),
      db.client.from('players').select('id', { count: 'exact', head: true })
        .eq('complex_id', req.tenantId).eq('is_active', true),
      db.client.from('reservations').select('id', { count: 'exact', head: true })
        .eq('complex_id', req.tenantId).eq('status', 'confirmed')
        .gte('starts_at', today + 'T00:00:00')
        .lte('starts_at', today + 'T23:59:59'),
      db.client.from('reservations').select('total_price')
        .eq('complex_id', req.tenantId).eq('status', 'confirmed')
        .gte('starts_at', monthStart),
    ]);

    const monthRevenue = (monthRes.data ?? []).reduce(
      (sum: number, r: { total_price: number | null }) => sum + (r.total_price ?? 0), 0
    );

    res.json({
      success: true,
      data: {
        total_courts: courtsRes.count ?? 0,
        total_players: playersRes.count ?? 0,
        bookings_today: todayRes.count ?? 0,
        revenue_this_month: monthRevenue,
      },
    });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

export default router;
