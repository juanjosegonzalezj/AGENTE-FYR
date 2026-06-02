import { getWhatsAppClient, isWhatsAppReady } from './client.js';
import logger from '../../utils/logger.js';

const MAX_LENGTH = 4096;

function truncate(text: string): string {
  return text.length <= MAX_LENGTH ? text : text.slice(0, MAX_LENGTH - 3) + '...';
}

export async function sendWhatsAppMessage(to: string, message: string): Promise<boolean> {
  const client = getWhatsAppClient();
  if (!client || !isWhatsAppReady()) {
    logger.warn(`WhatsApp no listo, no se puede enviar a ${to}`);
    return false;
  }

  // Soporta @c.us, @lid, @s.whatsapp.net y números planos (+57...)
  let chatId: string;
  if (to.includes('@c.us') || to.includes('@lid') || to.includes('@s.whatsapp.net')) {
    chatId = to.replace(/^\+/, '');
  } else {
    chatId = `${to.replace('+', '')}@c.us`;
  }

  try {
    await client.sendMessage(chatId, truncate(message));
    logger.debug(`WhatsApp enviado a ${chatId}`);
    return true;
  } catch (err: any) {
    logger.error(`Error enviando WhatsApp a ${chatId}`, { err: err.message });
    return false;
  }
}

export async function enviarRecordatorioPartido(
  telefono: string,
  detalles: {
    deporte: string;
    cancha: string;
    fecha: string;
    hora_inicio: string;
    hora_fin: string;
    rival: string;
  }
): Promise<boolean> {
  const mensaje =
    `⏰ *Recordatorio de partido – Find Your Rival*\n\n` +
    `Hola 👋 Tu partido comienza en *45 minutos*.\n\n` +
    `⚽ Deporte: ${detalles.deporte}\n` +
    `🏟️ Cancha: ${detalles.cancha}\n` +
    `📅 Fecha: ${detalles.fecha}\n` +
    `⏰ Hora: ${detalles.hora_inicio} – ${detalles.hora_fin}\n` +
    `👤 Rival: ${detalles.rival}\n\n` +
    `¡Te esperamos! 🏆`;

  return sendWhatsAppMessage(telefono, mensaje);
}

export async function enviarNotificacionSinRival(
  telefono: string,
  deporte: string
): Promise<boolean> {
  const mensaje =
    `⏳ Hola, llevamos 2 horas buscando un rival compatible para tu partido de ${deporte}.\n\n` +
    `Por ahora no encontramos a nadie disponible. Te avisaremos en cuanto aparezca un rival. 🙏\n\n` +
    `Si quieres cambiar tu horario o deporte, responde con el nuevo horario.`;

  return sendWhatsAppMessage(telefono, mensaje);
}

export async function enviarMensajePago(
  telefono: string,
  detalles: {
    reserva_id: number;
    deporte: string;
    cancha: string;
    fecha: string;
    hora_inicio: string;
    hora_fin: string;
    valor: number;
  }
): Promise<boolean> {
  const mensaje =
    `💳 *Datos de pago – Find Your Rival*\n\n` +
    `Para confirmar tu reserva, realiza el pago y envíanos el comprobante:\n\n` +
    `💰 Valor: $${detalles.valor.toLocaleString('es-CO')} COP\n\n` +
    `📲 Nequi / Daviplata: [número del complejo]\n` +
    `🏦 Cuenta bancaria: [datos del complejo]\n\n` +
    `📸 Una vez pagues, envíanos la foto del comprobante aquí mismo.\n\n` +
    `Reserva #${detalles.reserva_id} | ${detalles.deporte} | ${detalles.fecha} ${detalles.hora_inicio}`;

  return sendWhatsAppMessage(telefono, mensaje);
}
