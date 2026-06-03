import twilio from 'twilio';
import { config } from '../../config/index.js';
import logger from '../../utils/logger.js';

function getClient() {
  return twilio(config.TWILIO_ACCOUNT_SID, config.TWILIO_AUTH_TOKEN);
}

function formatTo(telefono: string): string {
  // Asegura formato whatsapp:+573232473822
  const num = telefono.replace('whatsapp:', '').replace(/^\+?/, '+');
  return `whatsapp:${num}`;
}

export async function enviarMensajeTwilio(to: string, body: string): Promise<boolean> {
  if (!config.TWILIO_ACCOUNT_SID || !config.TWILIO_AUTH_TOKEN || !config.TWILIO_WHATSAPP_NUMBER) {
    logger.warn('Twilio no configurado');
    return false;
  }

  try {
    await getClient().messages.create({
      from: `whatsapp:${config.TWILIO_WHATSAPP_NUMBER}`,
      to:   formatTo(to),
      body: body.slice(0, 1600), // límite Twilio WhatsApp
    });
    logger.debug(`Twilio enviado a ${to}`);
    return true;
  } catch (err: any) {
    logger.error(`Error Twilio a ${to}: ${err?.message ?? String(err)}`);
    return false;
  }
}

export async function enviarRecordatorioTwilio(
  telefono: string,
  detalles: { deporte: string; cancha: string; fecha: string; hora_inicio: string; hora_fin: string; rival: string }
): Promise<boolean> {
  return enviarMensajeTwilio(telefono,
    `⏰ *Recordatorio – Find Your Rival*\n\n` +
    `Hola 👋 Tu partido comienza en *45 minutos*.\n\n` +
    `⚽ ${detalles.deporte} | 🏟️ ${detalles.cancha}\n` +
    `📅 ${detalles.fecha} ${detalles.hora_inicio} – ${detalles.hora_fin}\n` +
    `👤 Rival: ${detalles.rival}\n\n¡Te esperamos! 🏆`
  );
}
