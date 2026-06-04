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

export async function enviarDatosPago(
  telefono: string,
  detalles: { reserva_id: number; deporte: string; fecha: string; hora_inicio: string; valor: number }
): Promise<boolean> {
  return enviarMensajeTwilio(telefono,
    `💳 *Datos de pago – Find Your Rival*\n\n` +
    `Para confirmar tu reserva realiza el pago y envíanos el comprobante:\n\n` +
    `💰 Valor: *$${detalles.valor.toLocaleString('es-CO')} COP*\n\n` +
    `🏦 *Bancolombia – Cuenta de Ahorros*\n` +
    `Número: *11576321165*\n\n` +
    `📸 Una vez pagues, envíanos aquí la foto del comprobante.\n\n` +
    `_Reserva #${detalles.reserva_id} | ${detalles.deporte} | ${detalles.fecha} ${detalles.hora_inicio}_`
  );
}
