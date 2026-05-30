import { Router } from 'express';
import { getAuthUrl, exchangeCodeForTokens } from '../../integrations/google-calendar/oauth.js';
import { listUserCalendars } from '../../integrations/google-calendar/events.js';
import { upsertCourtCalendar, getCalendarsByComplex } from '../../db/queries/courts.js';
import { config } from '../../config/index.js';
import type { Request, Response } from 'express';

const router = Router();

// GET /api/v1/calendar/connect?court_id=xxx
// Redirects admin to Google OAuth consent screen
router.get('/connect', (req: Request, res: Response) => {
  const courtId = req.query.court_id as string;
  if (!courtId) {
    return res.status(400).json({ success: false, error: 'court_id is required' });
  }

  // Encode state so we know which court to link after callback
  const state = Buffer.from(JSON.stringify({
    court_id: courtId,
    complex_id: req.tenantId,
  })).toString('base64');

  const authUrl = getAuthUrl(state);
  res.redirect(authUrl);
});

// GET /api/v1/calendar/oauth/callback
// Google redirects here after consent
router.get('/oauth/callback', async (req: Request, res: Response) => {
  const { code, state, error } = req.query as Record<string, string>;

  if (error) {
    return res.redirect(`${config.FRONTEND_URL}/dashboard/settings?calendar_error=${error}`);
  }

  try {
    const { court_id, complex_id } = JSON.parse(
      Buffer.from(state, 'base64').toString('utf-8')
    );

    const tokens = await exchangeCodeForTokens(code);
    if (!tokens.access_token || !tokens.refresh_token) {
      throw new Error('Missing tokens in Google response');
    }

    // List calendars so admin can pick the right one
    const calendars = await listUserCalendars(tokens.access_token, tokens.refresh_token);

    // Store tokens temporarily in session / return to frontend for calendar selection
    res.redirect(
      `${config.FRONTEND_URL}/dashboard/courts/${court_id}/calendar?` +
      `access_token=${encodeURIComponent(tokens.access_token)}` +
      `&refresh_token=${encodeURIComponent(tokens.refresh_token)}` +
      `&expires=${tokens.expiry_date ?? ''}` +
      `&calendars=${encodeURIComponent(JSON.stringify(calendars))}`
    );
  } catch (err: any) {
    res.redirect(`${config.FRONTEND_URL}/dashboard/settings?calendar_error=${err.message}`);
  }
});

// POST /api/v1/calendar/link
// Admin selects which Google Calendar to link to a court
router.post('/link', async (req: Request, res: Response) => {
  try {
    const {
      court_id,
      google_calendar_id,
      google_account_email,
      access_token,
      refresh_token,
      token_expires_at,
    } = req.body;

    if (!court_id || !google_calendar_id || !access_token || !refresh_token) {
      return res.status(400).json({ success: false, error: 'Missing required fields.' });
    }

    const calendar = await upsertCourtCalendar({
      complex_id: req.tenantId,
      court_id,
      google_calendar_id,
      google_account_email,
      access_token,
      refresh_token,
      token_expires_at,
      is_active: true,
    });

    res.json({ success: true, data: calendar });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// GET /api/v1/calendar/status
router.get('/status', async (req: Request, res: Response) => {
  try {
    const calendars = await getCalendarsByComplex(req.tenantId!);
    res.json({ success: true, data: calendars, total: calendars.length });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

export default router;
