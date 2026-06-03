// WhatsApp Web.js handler — mantenido para compatibilidad pero no activo en producción.
// En producción se usa Twilio (src/integrations/twilio/handler.ts).
import type WhatsApp from 'whatsapp-web.js';
import { runAgent } from '../../ai/agent.js';
import { confirmarPago, obtenerReservaPorTelefono } from '../../db/queries/reservas.js';
import { sendWhatsAppMessage } from './sender.js';
import logger from '../../utils/logger.js';

function normalizarTelefono(value: string): string {
  const digits = value
    .replace(/^whatsapp:/, '')
    .replace('@c.us', '')
    .replace('@lid', '')
    .replace('@s.whatsapp.net', '')
    .replace(/^\+/, '');
  return digits ? `+${digits}` : '';
}

function esMensajeDePago(texto: string): boolean {
  const palabras = ['pague','ya pague','comprobante','transferencia','consigne','hice el pago'];
  return palabras.some(p => texto.toLowerCase().includes(p));
}

export async function handleIncomingWhatsAppMessage(msg: WhatsApp.Message): Promise<void> {
  const telefono   = normalizarTelefono(msg.from);
  const texto      = msg.body?.trim() ?? '';
  const tieneMedia = msg.hasMedia;

  logger.info(`WhatsApp desde ${telefono}: "${texto.slice(0, 80)}"`);

  let chat: Awaited<ReturnType<typeof msg.getChat>> | null = null;
  try { chat = await msg.getChat(); await chat.sendStateTyping(); } catch { /* ok */ }

  const responder = async (r: string) => {
    try { if (chat) await chat.sendMessage(r); else await sendWhatsAppMessage(msg.from, r); }
    catch (e: any) { logger.error('Error enviando', { err: e?.message }); }
  };

  if (tieneMedia) {
    const reserva = await obtenerReservaPorTelefono(telefono);
    if (reserva && reserva.estado_pago === 'pendiente_pago') {
      try {
        const media = await msg.downloadMedia();
        const url   = media?.data ? `whatsapp_media_${Date.now()}` : undefined;
        const act   = await confirmarPago(reserva.id, url);
        await responder(`✅ Pago confirmado. Partido reservado el ${act.fecha} a las ${act.hora_inicio}. ¡Suerte! 🏆`);
      } catch { await responder('Recibí tu comprobante pero tuve un problema. Lo revisamos.'); }
    } else {
      await responder('Recibí tu imagen. ¿En qué puedo ayudarte?');
    }
    return;
  }

  if (esMensajeDePago(texto)) {
    const reserva = await obtenerReservaPorTelefono(telefono);
    if (reserva && reserva.estado_pago === 'pendiente_pago') {
      await responder('¡Perfecto! Envíame la foto del comprobante de pago. 📸');
      return;
    }
  }

  try {
    const { reply } = await runAgent(texto, telefono);
    await responder(reply);
  } catch (err: any) {
    logger.error('Error agente WhatsApp', { err: err?.message });
    await responder('Lo siento, tuve un problema. Intenta de nuevo. 🙏');
  }
}
