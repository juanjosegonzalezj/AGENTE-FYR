import { Router } from 'express';
import { tenantMiddleware } from '../middleware/tenant.js';
import { authMiddleware } from '../middleware/auth.js';

import courtsRouter from './v1/courts.js';
import reservationsRouter from './v1/reservations.js';
import playersRouter from './v1/players.js';
import aiRouter from './v1/ai.js';
import calendarRouter from './v1/calendar.js';
import analyticsRouter from './v1/analytics.js';
import whatsappWebhookRouter from './webhooks/whatsapp.js';

const router = Router();

// WhatsApp webhook — no auth/tenant (uses internal resolution)
router.use('/webhooks/whatsapp', whatsappWebhookRouter);

// All v1 API routes require tenant resolution.
// auth is optional per-route (admin routes require it, AI chat does not for demos).
router.use('/api/v1', tenantMiddleware, (subRouter => {
  subRouter.use('/courts', courtsRouter);
  subRouter.use('/reservations', reservationsRouter);
  subRouter.use('/players', playersRouter);
  subRouter.use('/ai', aiRouter);
  subRouter.use('/calendar', calendarRouter);
  subRouter.use('/analytics', analyticsRouter);
  return subRouter;
})(Router()));

export default router;
