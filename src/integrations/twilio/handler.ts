import type { Request, Response } from 'express';
import { runAgent } from '../../ai/agent.js';
import { confirmarPago, obtenerReservaPorTelefono } from '../../db/queries/reservas.js';
import { buscarSolicitudEsperandoConfirmacion, actualizarSolicitud, obtenerSolicitudPorTelefono } from '../../db/queries/solicitudes.js';
import { enviarMensajeTwilio } from './sender.js';
import logger from '../../utils/logger.js';

function normalizarTelefono(from: string): string {
  return from.replace('whatsapp:', '').trim();
}

function esMensajeDePago(texto: string): boolean {
  const palabras = ['pagué','pague','ya pagué','ya pague','aquí está','te mando',
    'te envío','comprobante','transferencia','consigné','consigne',
    'hice el pago','realicé el pago','pago hecho'];
  return palabras.some(p => texto.toLowerCase().includes(p));
}

function esConfirmacionPositiva(texto: string): boolean {
  const t = texto.toLowerCase().trim();
  // Acepta "1" (opción del menú 1. Sí) o palabras afirmativas
  if (t === '1') return true;
  const si = ['sí','si','yes','claro','dale','va','perfecto','confirmo','de acuerdo','ok','okey','listo'];
  return si.some(p => t === p || t.startsWith(p));
}

function esConfirmacionNegativa(texto: string): boolean {
  const t = texto.toLowerCase().trim();
  // Acepta "2" (opción del menú 2. No) o palabras negativas
  if (t === '2') return true;
  const no = ['no','nel','nope','no puedo','cancelar','rechazar'];
  return no.some(p => t === p || t.startsWith(p));
}

export async function handleTwilioWebhook(req: Request, res: Response): Promise<void> {
  res.status(200).send('<Response></Response>');

  const from     = req.body?.From ?? '';
  const body     = (req.body?.Body ?? '').trim();
  const numMedia = parseInt(req.body?.NumMedia ?? '0', 10);
  const mediaUrl = req.body?.MediaUrl0 ?? null;

  if (!from) return;

  const telefono = normalizarTelefono(from);
  logger.info(`Twilio desde ${telefono}: "${body.slice(0, 80)}"${numMedia > 0 ? ' [media]' : ''}`);

  const responder = (texto: string) => enviarMensajeTwilio(telefono, texto);

  // ── 1. ¿Es el rival respondiendo a la invitación? ─────────────────────────
  const solicitudEsperando = await buscarSolicitudEsperandoConfirmacion(telefono);
  if (solicitudEsperando) {
    await procesarRespuestaRival(telefono, body, solicitudEsperando, responder);
    return;
  }

  // ── 2. Media → comprobante de pago ────────────────────────────────────────
  if (numMedia > 0 && mediaUrl) {
    await manejarComprobante(telefono, mediaUrl, responder);
    return;
  }

  // ── 3. Anuncio de pago sin imagen ─────────────────────────────────────────
  if (esMensajeDePago(body)) {
    const reserva = await obtenerReservaPorTelefono(telefono);
    if (reserva && reserva.estado_pago === 'pendiente_pago') {
      await responder('¡Perfecto! Para confirmar tu reserva, envíame la foto o captura del comprobante de pago. 📸');
      return;
    }
  }

  // ── 4. Mensaje normal → agente Lucía ─────────────────────────────────────
  try {
    const { reply } = await runAgent(body, telefono);
    await responder(reply);
  } catch (err: any) {
    logger.error('Error agente Twilio', { err: err?.message ?? String(err) });
    await responder('Lo siento, tuve un problema. Intenta de nuevo en un momento. 🙏');
  }
}

async function procesarRespuestaRival(
  rivalTelefono: string,
  texto: string,
  solicitud: Awaited<ReturnType<typeof buscarSolicitudEsperandoConfirmacion>> & object,
  responder: (t: string) => Promise<boolean>
): Promise<void> {
  const solicitanteTelefono = solicitud!.telefono;
  const solicitanteNombre   = solicitud!.nombre;
  const rivalNombre         = solicitud!.rival_nombre ?? 'Rival';

  if (esConfirmacionPositiva(texto)) {
    // Rival confirma → actualizar solicitud y notificar al solicitante
    await actualizarSolicitud(solicitud!.id, {
      rival_confirmacion_estado: 'confirmado',
      estado: 'pendiente_pago',
    });

    await responder(
      `Perfecto. Confirmaste tu disponibilidad. En breve recibirás los detalles del partido.`
    );

    // Notificar al solicitante — mensaje exacto de la especificación
    await enviarMensajeTwilio(
      solicitanteTelefono,
      `¡Buenas noticias! Encontramos un rival compatible para ti. En breve recibirás los detalles del partido.`
    );

    logger.info(`Rival ${rivalNombre} confirmó para solicitud #${solicitud!.id}`);

  } else if (esConfirmacionNegativa(texto)) {
    // Rival rechaza → marcar y notificar al solicitante para buscar otro
    await actualizarSolicitud(solicitud!.id, {
      rival_confirmacion_estado: 'rechazado',
      rival_encontrado:          false,
      rival_nombre:              null,
      rival_telefono:            null,
      estado:                    'pendiente',
      busqueda_activa:           true,
    });

    await responder(
      `Entendido, gracias por responder ${rivalNombre}. ¡Hasta la próxima! 👋`
    );

    await enviarMensajeTwilio(
      solicitanteTelefono,
      `Lo siento ${solicitanteNombre}, *${rivalNombre}* no está disponible en este momento.\n\n` +
      `Estoy buscando otro rival compatible para ti. Te aviso pronto. 🔍`
    );

    logger.info(`Rival ${rivalNombre} rechazó solicitud #${solicitud!.id}`);

  } else {
    // Respuesta ambigua → pedir que aclare
    await responder(
      `Hola ${rivalNombre} 👋 Para confirmar tu disponibilidad para el partido, responde solo:\n\n` +
      `*SÍ* — si puedes jugar\n*NO* — si no puedes`
    );
  }
}

async function manejarComprobante(
  telefono: string,
  mediaUrl: string,
  responder: (t: string) => Promise<boolean>
): Promise<void> {
  const reserva = await obtenerReservaPorTelefono(telefono);

  if (!reserva) {
    await responder('Recibí tu imagen, pero no tienes una reserva pendiente de pago. ¿En qué puedo ayudarte?');
    return;
  }

  if (reserva.estado_pago === 'confirmado') {
    await responder(`Tu reserva #${reserva.id} ya está confirmada. ¡Nos vemos el ${reserva.fecha} a las ${reserva.hora_inicio}! ⚽`);
    return;
  }

  try {
    const actualizada = await confirmarPago(reserva.id, mediaUrl);

    await responder(
      `✅ *¡Pago confirmado!*\n\n` +
      `Tu partido está RESERVADO 🎉\n\n` +
      `📅 ${actualizada.fecha} | ⏰ ${actualizada.hora_inicio} – ${actualizada.hora_fin}\n` +
      `🏟️ ${actualizada.cancha} | ⚽ ${actualizada.deporte}\n\n` +
      `Recordatorio 45 min antes. ¡Buena suerte! 🏆`
    );

    const telefonoRival = actualizada.telefono_1 === telefono ? actualizada.telefono_2 : actualizada.telefono_1;
    const nombre        = actualizada.telefono_1 === telefono ? actualizada.capitan_1  : actualizada.capitan_2;

    await enviarMensajeTwilio(telefonoRival,
      `🎉 *¡Partido confirmado!*\n${nombre} confirmó el pago.\n\n` +
      `📅 ${actualizada.fecha} ${actualizada.hora_inicio} – ${actualizada.hora_fin}\n` +
      `🏟️ ${actualizada.cancha}\n\n¡Te esperamos! 💪`
    );
  } catch (err: any) {
    logger.error('Error confirmando pago', { err: err?.message ?? String(err) });
    await responder('Recibí tu comprobante pero tuve un problema. Lo revisamos manualmente. 🙏');
  }
}
