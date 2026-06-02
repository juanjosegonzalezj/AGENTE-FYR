import { google, calendar_v3 } from 'googleapis';
import { config } from '../../config/index.js';
import logger from '../../utils/logger.js';

let calendarClient: calendar_v3.Calendar | null = null;

export async function getCalendarClient(): Promise<calendar_v3.Calendar | null> {
  if (!config.GOOGLE_CLIENT_ID || !config.GOOGLE_CLIENT_SECRET || !config.GOOGLE_REFRESH_TOKEN) {
    logger.warn('Google Calendar no configurado – faltan credenciales en .env');
    return null;
  }

  if (calendarClient) return calendarClient;

  const oauth2Client = new google.auth.OAuth2(
    config.GOOGLE_CLIENT_ID,
    config.GOOGLE_CLIENT_SECRET,
    config.GOOGLE_REDIRECT_URI
  );

  oauth2Client.setCredentials({ refresh_token: config.GOOGLE_REFRESH_TOKEN });

  // Auto-refresh: googleapi lo maneja automáticamente con refresh_token
  calendarClient = google.calendar({ version: 'v3', auth: oauth2Client });
  logger.info('Google Calendar client inicializado');
  return calendarClient;
}

export function getCalendarId(): string {
  return config.GOOGLE_CALENDAR_ID;
}
