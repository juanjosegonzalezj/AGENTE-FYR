import { getCalendarClient, getCalendarId } from './client.js';
import logger from '../../utils/logger.js';

const TZ = 'America/Bogota';

const COLORES: Record<string, string> = {
  'fútbol': '2',  // Verde
  'pádel':  '7',  // Teal
};

export async function crearEventoCalendario(payload: {
  titulo: string;
  descripcion?: string;
  inicio: string;   // ISO datetime
  fin: string;      // ISO datetime
  deporte: string;
}): Promise<string | null> {
  const cal = await getCalendarClient();
  const calId = getCalendarId();
  if (!cal || !calId) return null;

  try {
    const event = await cal.events.insert({
      calendarId: calId,
      requestBody: {
        summary: payload.titulo,
        description: payload.descripcion,
        start: { dateTime: payload.inicio, timeZone: TZ },
        end:   { dateTime: payload.fin,   timeZone: TZ },
        colorId: COLORES[payload.deporte] ?? '1',
        reminders: {
          useDefault: false,
          overrides: [
            { method: 'popup', minutes: 60 },
            { method: 'popup', minutes: 30 },
          ],
        },
      },
    });
    logger.info(`Evento Calendar creado: ${event.data.id}`);
    return event.data.id ?? null;
  } catch (err) {
    logger.error('Error creando evento Calendar', { err });
    return null;
  }
}

export async function eliminarEventoCalendario(eventId: string): Promise<boolean> {
  const cal = await getCalendarClient();
  const calId = getCalendarId();
  if (!cal || !calId) return false;

  try {
    await cal.events.delete({ calendarId: calId, eventId });
    logger.info(`Evento Calendar eliminado: ${eventId}`);
    return true;
  } catch (err) {
    logger.error('Error eliminando evento Calendar', { err });
    return false;
  }
}
