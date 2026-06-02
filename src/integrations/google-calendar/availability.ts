import { google } from 'googleapis';
import { getCalendarClient, getCalendarId } from './client.js';
import { config } from '../../config/index.js';
import type { SlotDisponible } from '../../types/index.js';
import logger from '../../utils/logger.js';

const HORA_APERTURA = 6;   // 06:00
const HORA_CIERRE   = 23;  // 23:00
const TZ = 'America/Bogota';

function generarSlots(
  fecha: string,
  periodosBloqueados: Array<{ start: string; end: string }>
): SlotDisponible[] {
  const slots: SlotDisponible[] = [];

  for (let hora = HORA_APERTURA; hora < HORA_CIERRE; hora++) {
    const ini  = `${hora.toString().padStart(2, '0')}:00`;
    const fin  = `${(hora + 1).toString().padStart(2, '0')}:00`;
    const iniDt = new Date(`${fecha}T${ini}:00`);
    const finDt = new Date(`${fecha}T${fin}:00`);

    const bloqueado = periodosBloqueados.some(b => {
      const bIni = new Date(b.start);
      const bFin = new Date(b.end);
      return iniDt < bFin && finDt > bIni;
    });

    slots.push({ inicio: ini, fin, disponible: !bloqueado });
  }

  return slots;
}

// Consulta freebusy con OAuth2 (requiere refresh token — permite escritura también)
async function consultarConOAuth(fecha: string, calId: string): Promise<SlotDisponible[] | null> {
  const cal = await getCalendarClient();
  if (!cal) return null;

  try {
    const diaInicio = new Date(`${fecha}T00:00:00`);
    const diaFin    = new Date(`${fecha}T23:59:59`);

    const resp = await cal.freebusy.query({
      requestBody: {
        timeMin: diaInicio.toISOString(),
        timeMax: diaFin.toISOString(),
        timeZone: TZ,
        items: [{ id: calId }],
      },
    });

    const ocupados = resp.data.calendars?.[calId]?.busy ?? [];
    return generarSlots(fecha, ocupados.map(b => ({ start: b.start ?? '', end: b.end ?? '' })));
  } catch (err) {
    logger.warn('OAuth freebusy falló', { err });
    return null;
  }
}

// Consulta freebusy con API Key (solo lectura — funciona si el calendario es público)
async function consultarConApiKey(fecha: string, calId: string): Promise<SlotDisponible[] | null> {
  if (!config.GOOGLE_API_KEY) return null;

  try {
    const cal = google.calendar({ version: 'v3', auth: config.GOOGLE_API_KEY });
    const diaInicio = new Date(`${fecha}T00:00:00`);
    const diaFin    = new Date(`${fecha}T23:59:59`);

    const resp = await cal.freebusy.query({
      key: config.GOOGLE_API_KEY,
      requestBody: {
        timeMin: diaInicio.toISOString(),
        timeMax: diaFin.toISOString(),
        timeZone: TZ,
        items: [{ id: calId }],
      },
    });

    const ocupados = resp.data.calendars?.[calId]?.busy ?? [];
    return generarSlots(fecha, ocupados.map(b => ({ start: b.start ?? '', end: b.end ?? '' })));
  } catch (err) {
    logger.warn('API Key freebusy falló (calendario puede ser privado)', { err });
    return null;
  }
}

export async function consultarDisponibilidad(fecha: string): Promise<SlotDisponible[]> {
  const calId = getCalendarId();

  if (!calId) {
    logger.warn('GOOGLE_CALENDAR_ID no configurado – retornando todos los slots libres');
    return generarSlots(fecha, []);
  }

  // Intento 1: OAuth2 (necesario para calendarios privados y para crear eventos)
  const conOAuth = await consultarConOAuth(fecha, calId);
  if (conOAuth) return conOAuth;

  // Intento 2: API Key (solo funciona si el calendario está configurado como público)
  const conApiKey = await consultarConApiKey(fecha, calId);
  if (conApiKey) return conApiKey;

  // Fallback: todos los slots libres (Calendar no disponible)
  logger.warn('Google Calendar no disponible – mostrando todos los slots como libres');
  return generarSlots(fecha, []);
}
