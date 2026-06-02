import type WhatsApp from 'whatsapp-web.js';
import { runAgent } from '../../ai/agent.js';
import { confirmarPago, obtenerReservaPorTelefono } from '../../db/queries/reservas.js';
import { sendWhatsAppMessage } from './sender.js';
import logger from '../../utils/logger.js';

function normalizarTelefono(value: string): string {
  const withoutPrefix = value.replace(/^whatsapp:/, '');
  if (withoutPrefix.startsWith('+')) return withoutPrefix;

  const digits = withoutPrefix
    .replace('@c.us', '')
    .replace('@lid', '')
    .replace('@s.whatsapp.net', '')
    .replace(/^\+/, '');

  return digits ? `+${digits}` : '';
}

function esMensajeDePago(texto: string): boolean {
  const palabrasClave = [
    'pague', 'ya pague', 'comprobante', 'transferencia', 'consigne',
    'hice el pago', 'realice el pago', 'pago hecho',
  ];
  const lower = texto.toLowerCase();
  return palabrasClave.some(p => lower.includes(p));
}

export async function handleIncomingWhatsAppText(input: {
  from: string;
  to?: string;
  text: string;
}): Promise<string> {
  const telefono = normalizarTelefono(input.from);
  const texto = input.text.trim();

  logger.info(`WhatsApp desde ${telefono}: "${texto.slice(0, 80)}"`);

  if (esMensajeDePago(texto)) {
    const reserva = await obtenerReservaPorTelefono(telefono);
    if (reserva && reserva.estado_pago === 'pendiente_pago') {
      return 'Perfecto. Para confirmar tu reserva, enviame la foto o captura del comprobante de pago.';
    }
  }

  try {
    const { reply } = await runAgent(texto, telefono);
    return reply;
  } catch (err: any) {
    logger.error('Error ejecutando agente', { telefono, err: err?.message ?? String(err) });
    return 'Lo siento, tuve un problema. Intenta de nuevo en un momento.';
  }
}

export async function handleIncomingWhatsAppMessage(msg: WhatsApp.Message): Promise<void> {
  const chatId = msg.from;
  const telefono = normalizarTelefono(msg.from);
  const texto = msg.body?.trim() ?? '';
  const tieneMedia = msg.hasMedia;

  logger.info(`WhatsApp desde ${telefono}: "${texto.slice(0, 80)}"${tieneMedia ? ' [media]' : ''}`);

  let chat: Awaited<ReturnType<typeof msg.getChat>> | null = null;
  try {
    chat = await msg.getChat();
    await chat.sendStateTyping();
  } catch {
    // Typing state is helpful but not required.
  }

  const responder = async (respuesta: string) => {
    try {
      if (chat) {
        await chat.sendMessage(respuesta);
      } else {
        await sendWhatsAppMessage(chatId, respuesta);
      }
    } catch (err: any) {
      logger.error('Error enviando respuesta', { err: err?.message ?? String(err) });
    }
  };

  if (tieneMedia) {
    await manejarComprobante(msg, responder, telefono);
    return;
  }

  const reply = await handleIncomingWhatsAppText({
    from: telefono,
    to: normalizarTelefono(msg.to ?? ''),
    text: texto,
  });
  await responder(reply);
}

async function manejarComprobante(
  msg: WhatsApp.Message,
  responder: (texto: string) => Promise<void>,
  telefono: string
): Promise<void> {
  const reserva = await obtenerReservaPorTelefono(telefono);

  if (!reserva) {
    await responder('Recibi tu imagen, pero no tienes una reserva pendiente de pago. En que puedo ayudarte?');
    return;
  }

  if (reserva.estado_pago === 'confirmado') {
    await responder(`Tu reserva #${reserva.id} ya esta confirmada y pagada. Nos vemos el ${reserva.fecha} a las ${reserva.hora_inicio}!`);
    return;
  }

  let comprobanteUrl: string | undefined;
  try {
    const media = await msg.downloadMedia();
    if (media?.data) {
      comprobanteUrl = `whatsapp_media_${Date.now()}`;
      logger.info(`Comprobante recibido de ${telefono}`, { mimetype: media.mimetype });
    }
  } catch (err) {
    logger.warn('No se pudo descargar la media', { err });
  }

  try {
    const actualizada = await confirmarPago(reserva.id, comprobanteUrl);

    await responder(
      `*Pago confirmado!*\n\n` +
      `Tu partido esta RESERVADO.\n\n` +
      `Fecha: ${actualizada.fecha}\n` +
      `Hora: ${actualizada.hora_inicio} - ${actualizada.hora_fin}\n` +
      `Cancha: ${actualizada.cancha}\n` +
      `Deporte: ${actualizada.deporte}\n\n` +
      `Te enviamos un recordatorio 45 minutos antes.`
    );

    const telefonoRival = actualizada.telefono_1 === telefono
      ? actualizada.telefono_2
      : actualizada.telefono_1;
    const nombreSolicitante = actualizada.telefono_1 === telefono
      ? actualizada.capitan_1
      : actualizada.capitan_2;

    await sendWhatsAppMessage(telefonoRival,
      `*Partido confirmado!*\n\n` +
      `${nombreSolicitante} confirmo el pago.\n\n` +
      `Fecha: ${actualizada.fecha}\n` +
      `Hora: ${actualizada.hora_inicio} - ${actualizada.hora_fin}\n` +
      `Cancha: ${actualizada.cancha}\n\n` +
      `Te esperamos!`
    );
  } catch (err: any) {
    logger.error('Error confirmando pago', { err: err?.message ?? String(err) });
    await responder('Recibi tu comprobante pero tuve un problema al confirmarlo. Lo revisamos manualmente.');
  }
}
