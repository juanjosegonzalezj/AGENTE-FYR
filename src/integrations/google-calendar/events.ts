import { getCalendarClient } from './client.js';
import { getCourtCalendar } from '../../db/queries/courts.js';
import logger from '../../utils/logger.js';

// Sport-specific event colors (Google Calendar color IDs)
const SPORT_COLORS: Record<string, string> = {
  padel:      '7',  // Teal
  tennis:     '9',  // Blueberry
  soccer:     '2',  // Sage
  basketball: '5',  // Banana
  volleyball: '3',  // Grape
};

export interface CalendarEventPayload {
  title: string;
  description?: string;
  startsAt: string;  // ISO datetime
  endsAt: string;    // ISO datetime
  sport: string;
  attendeeEmails?: string[];
}

export async function createCalendarEvent(
  courtId: string,
  payload: CalendarEventPayload
): Promise<string | null> {
  const calRecord = await getCourtCalendar(courtId);
  if (!calRecord) return null;

  const calClient = await getCalendarClient(courtId);
  if (!calClient) return null;

  try {
    const event = await calClient.events.insert({
      calendarId: calRecord.google_calendar_id,
      requestBody: {
        summary: payload.title,
        description: payload.description,
        start: { dateTime: payload.startsAt, timeZone: 'Europe/Madrid' },
        end: { dateTime: payload.endsAt, timeZone: 'Europe/Madrid' },
        colorId: SPORT_COLORS[payload.sport] ?? '1',
        attendees: payload.attendeeEmails?.map(email => ({ email })),
        reminders: {
          useDefault: false,
          overrides: [
            { method: 'email', minutes: 60 },
            { method: 'popup', minutes: 30 },
          ],
        },
      },
    });

    logger.info(`Calendar event created: ${event.data.id}`);
    return event.data.id ?? null;
  } catch (err) {
    logger.error('Failed to create calendar event', { courtId, err });
    return null;
  }
}

export async function updateCalendarEvent(
  courtId: string,
  eventId: string,
  payload: Partial<CalendarEventPayload>
): Promise<boolean> {
  const calRecord = await getCourtCalendar(courtId);
  if (!calRecord) return false;

  const calClient = await getCalendarClient(courtId);
  if (!calClient) return false;

  try {
    const updateBody: Record<string, unknown> = {};
    if (payload.title) updateBody.summary = payload.title;
    if (payload.description) updateBody.description = payload.description;
    if (payload.startsAt) updateBody.start = { dateTime: payload.startsAt, timeZone: 'Europe/Madrid' };
    if (payload.endsAt) updateBody.end = { dateTime: payload.endsAt, timeZone: 'Europe/Madrid' };

    await calClient.events.patch({
      calendarId: calRecord.google_calendar_id,
      eventId,
      requestBody: updateBody,
    });

    logger.info(`Calendar event updated: ${eventId}`);
    return true;
  } catch (err) {
    logger.error('Failed to update calendar event', { courtId, eventId, err });
    return false;
  }
}

export async function deleteCalendarEvent(
  courtId: string,
  eventId: string
): Promise<boolean> {
  const calRecord = await getCourtCalendar(courtId);
  if (!calRecord) return false;

  const calClient = await getCalendarClient(courtId);
  if (!calClient) return false;

  try {
    await calClient.events.delete({
      calendarId: calRecord.google_calendar_id,
      eventId,
    });
    logger.info(`Calendar event deleted: ${eventId}`);
    return true;
  } catch (err) {
    logger.error('Failed to delete calendar event', { courtId, eventId, err });
    return false;
  }
}

export async function listUserCalendars(
  accessToken: string,
  refreshToken: string
): Promise<Array<{ id: string; summary: string; primary?: boolean }>> {
  const { createAuthorisedClient } = await import('./oauth.js');
  const client = createAuthorisedClient(accessToken, refreshToken);
  const cal = (await import('googleapis')).google.calendar({ version: 'v3', auth: client });

  const { data } = await cal.calendarList.list({ maxResults: 50 });
  return (data.items ?? []).map(item => ({
    id: item.id ?? '',
    summary: item.summary ?? 'Untitled',
    primary: item.primary ?? false,
  }));
}
