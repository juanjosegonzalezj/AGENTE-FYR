import type WhatsApp from 'whatsapp-web.js';
import { runAgent } from '../../ai/agent.js';
import { confirmarPago, obtenerReservaPorTelefono } from '../../db/queries/reservas.js';
import { sendWhatsAppMessage } from './sender.js';
import logger from '../../utils/logger.js';

function normalizarTelefono(from: string): string {
  // Elimina cualquier sufijo de WhatsApp (@c.us, @lid, @s.whatsapp.net)
  // y agrega + al inicio para tener formato E.164 limpio
  const digits = from
    .replace('@c.us', '')
    .replace('@lid', '')
    .replace('@s.whatsapp.net', '')
    .replace(/^\+/, '');
  return `+${digits}`;
}

function esMensajeDePago(texto: string): boolean {
  const palabrasClave = [
    'pagué', 'pague', 'ya pagué', 'ya pague', 'aquí está',
    'te mando', 'te envío', 'comprobante', 'transferencia', 'consigné',
    'consigne', 'hice el pago', 'realicé el pago', 'pago hecho',
  ];
  const lower = texto.toLowerCase();
  return palabrasClave.some(p => lower.includes(p));
}

export async function handleIncomingWhatsAppMessage(msg: WhatsApp.Message): Promise<void> {
  const chatId   = msg.from;                      // ID original de WhatsApp (para enviar)
  const telefono = normalizarTelefono(msg.from);  // Número limpio (para DB y agente)
  const texto    = msg.body?.trim() ?? '';
  const tieneMedia = msg.hasMedia;

  logger.info(`WhatsApp desde ${telefono}: "${texto.slice(0, 80)}"${tieneMedia ? ' [media]' : ''}`);

  // Obtener el chat para responder directamente (evita problemas con @lid)
  let chat: Awaited<ReturnType<typeof msg.getChat>> | null = null;
  try {
    chat = await msg.getChat();
    await chat.sendStateTyping();
  } catch { /* no crítico */ }

  // Función helper: responde usando el chat original si está disponible
  const responder = async (texto: string) => {
    try {
      if (chat) {
        await chat.sendMessage(texto);
      } else {
        await sendWhatsAppMessage(chatId, texto);
      }
    } catch (err: any) {
      logger.error('Error enviando respuesta', { err: err?.message ?? String(err) });
    }
  };

  // ── Media → posible comprobante de pago ───────────────────────────────────
  if (tieneMedia) {
    await manejarComprobante(msg, responder, telefono);
    return;
  }

  // ── Anuncio de pago sin imagen → pedir comprobante ────────────────────────
  if (esMensajeDePago(texto)) {
    const reserva = await obtenerReservaPorTelefono(telefono);
    if (reserva && reserva.estado_pago === 'pendiente_pago') {
      await responder('¡Perfecto! Para confirmar tu reserva, envíame la foto o captura del comprobante de pago. 📸');
      return;
    }
  }

  // ── Mensaje normal → agente Lucía ─────────────────────────────────────────
  try {
    const { reply } = await runAgent(texto, telefono);
    await responder(reply);
  } catch (err: any) {
    logger.error('Error ejecutando agente', { telefono, err: err?.message ?? String(err) });
    await responder('Lo siento, tuve un problema. Intenta de nuevo en un momento. 🙏');
  }
}

async function manejarComprobante(
  msg: WhatsApp.Message,
  responder: (texto: string) => Promise<void>,
  telefono: string
): Promise<void> {
  const reserva = await obtenerReservaPorTelefono(telefono);

  if (!reserva) {
    await responder('Recibí tu imagen, pero no tienes una reserva pendiente de pago. ¿En qué puedo ayudarte?');
    return;
  }

  if (reserva.estado_pago === 'confirmado') {
    await responder(`Tu reserva #${reserva.id} ya está confirmada y pagada. ¡Nos vemos el ${reserva.fecha} a las ${reserva.hora_inicio}! ⚽`);
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
      `✅ *¡Pago confirmado!*\n\n` +
      `Tu partido está RESERVADO 🎉\n\n` +
      `📅 Fecha: ${actualizada.fecha}\n` +
      `⏰ Hora: ${actualizada.hora_inicio} – ${actualizada.hora_fin}\n` +
      `🏟️ Cancha: ${actualizada.cancha}\n` +
      `⚽ Deporte: ${actualizada.deporte}\n\n` +
      `Te enviamos un recordatorio 45 minutos antes. ¡Buena suerte! 🏆`
    );

    // Notificar al rival (usa sendWhatsAppMessage con número de teléfono)
    const telefonoRival = actualizada.telefono_1 === telefono
      ? actualizada.telefono_2
      : actualizada.telefono_1;
    const nombreSolicitante = actualizada.telefono_1 === telefono
      ? actualizada.capitan_1
      : actualizada.capitan_2;

    await sendWhatsAppMessage(telefonoRival,
      `🎉 *¡Partido confirmado!*\n\n` +
      `${nombreSolicitante} confirmó el pago.\n\n` +
      `📅 Fecha: ${actualizada.fecha}\n` +
      `⏰ Hora: ${actualizada.hora_inicio} – ${actualizada.hora_fin}\n` +
      `🏟️ Cancha: ${actualizada.cancha}\n\n` +
      `¡Te esperamos! 💪`
    );
  } catch (err: any) {
    logger.error('Error confirmando pago', { err: err?.message ?? String(err) });
    await responder('Recibí tu comprobante pero tuve un problema al confirmarlo. Lo revisamos manualmente. 🙏');
  }
}
