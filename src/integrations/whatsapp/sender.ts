// WhatsApp sender — no direct WAWebJS type import needed
import { getWhatsAppClient, isWhatsAppReady } from './client.js';
import logger from '../../utils/logger.js';

// Max WhatsApp message length
const MAX_LENGTH = 4096;

function truncate(text: string): string {
  if (text.length <= MAX_LENGTH) return text;
  return text.slice(0, MAX_LENGTH - 3) + '...';
}

export async function sendWhatsAppMessage(
  to: string,
  message: string
): Promise<boolean> {
  const client = getWhatsAppClient();
  if (!client || !isWhatsAppReady()) {
    logger.warn(`WhatsApp not ready, cannot send message to ${to}`);
    return false;
  }

  const chatId = to.includes('@c.us') ? to : `${to}@c.us`;

  try {
    await client.sendMessage(chatId, truncate(message));
    logger.debug(`WhatsApp message sent to ${chatId}`);
    return true;
  } catch (err: any) {
    logger.error(`Failed to send WhatsApp message to ${chatId}`, { err: err.message });
    return false;
  }
}

export async function sendReservationConfirmation(
  phone: string,
  details: {
    courtName: string;
    sport: string;
    startLabel: string;
    durationMinutes: number;
    price: string;
    reservationId: string;
  }
): Promise<boolean> {
  const message =
    `✅ *Reserva Confirmada*\n\n` +
    `🏟️ ${details.courtName}\n` +
    `🎾 ${details.sport.charAt(0).toUpperCase() + details.sport.slice(1)}\n` +
    `📅 ${details.startLabel}\n` +
    `⏱️ ${details.durationMinutes} minutos\n` +
    `💶 ${details.price}\n\n` +
    `ID: \`${details.reservationId.slice(0, 8)}\`\n\n` +
    `Para cancelar responde "cancelar ${details.reservationId.slice(0, 8)}"`;

  return sendWhatsAppMessage(phone, message);
}

export async function sendMatchFound(
  phone: string,
  opponent: { name: string; sport: string; skillLevel: string; compatibility: number }
): Promise<boolean> {
  const message =
    `🎯 *¡Rival Encontrado!*\n\n` +
    `👤 ${opponent.name}\n` +
    `🎾 ${opponent.sport}\n` +
    `⭐ Nivel: ${opponent.skillLevel}\n` +
    `🔥 Compatibilidad: ${opponent.compatibility}%\n\n` +
    `¿Te interesa? Responde "sí" para ver horarios disponibles o "siguiente" para ver otro rival.`;

  return sendWhatsAppMessage(phone, message);
}

export async function sendReminderMessage(
  phone: string,
  details: { courtName: string; startLabel: string; sport: string }
): Promise<boolean> {
  const message =
    `⏰ *Recordatorio de Reserva*\n\n` +
    `Tu partido de ${details.sport} en ${details.courtName} comienza pronto.\n` +
    `📅 ${details.startLabel}\n\n` +
    `¡Suerte! 🏆`;

  return sendWhatsAppMessage(phone, message);
}
