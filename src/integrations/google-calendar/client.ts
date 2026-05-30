import { google, calendar_v3 } from 'googleapis';
import { createAuthorisedClient } from './oauth.js';
import { upsertCourtCalendar, getCourtCalendar } from '../../db/queries/courts.js';
import logger from '../../utils/logger.js';

// Returns a Google Calendar API instance with a valid (refreshed) token
export async function getCalendarClient(courtId: string): Promise<calendar_v3.Calendar | null> {
  const cal = await getCourtCalendar(courtId);
  if (!cal || !cal.access_token || !cal.refresh_token) return null;

  const oauth2Client = createAuthorisedClient(cal.access_token, cal.refresh_token);

  // Proactively refresh if expiring within 5 minutes
  const expiresAt = cal.token_expires_at ? new Date(cal.token_expires_at) : null;
  const fiveMin = new Date(Date.now() + 5 * 60 * 1000);

  if (!expiresAt || expiresAt < fiveMin) {
    try {
      const { credentials } = await oauth2Client.refreshAccessToken();
      await upsertCourtCalendar({
        court_id: courtId,
        access_token: credentials.access_token ?? cal.access_token,
        token_expires_at: credentials.expiry_date
          ? new Date(credentials.expiry_date).toISOString()
          : undefined,
      });
      oauth2Client.setCredentials(credentials);
      logger.debug(`Refreshed Google token for court ${courtId}`);
    } catch (err) {
      logger.error('Failed to refresh Google token', { courtId, err });
      return null;
    }
  }

  return google.calendar({ version: 'v3', auth: oauth2Client });
}
