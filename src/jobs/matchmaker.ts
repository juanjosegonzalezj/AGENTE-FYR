import {
  obtenerSolicitudesPendientesBusqueda,
  obtenerSolicitudesVencidas,
  actualizarSolicitud,
} from '../db/queries/solicitudes.js';
import { buscarRival } from '../ai/tools/matchmaking.js';
import { enviarNotificacionSinRival, sendWhatsAppMessage } from '../integrations/whatsapp/sender.js';
import { enviarMensajeTwilio } from '../integrations/twilio/sender.js';
import type { Solicitud, DeporteTipo, NivelFutbol, NivelPadel } from '../types/index.js';
import logger from '../utils/logger.js';

async function contactarRivalJob(opts: {
  solicitudId: number;
  rivalNombre: string;
  rivalTelefono: string;
  solicitanteNombre: string;
  deporte: string;
  nivel: string;
}): Promise<boolean> {
  const mensaje =
    `Hola ${opts.rivalNombre} 👋 Soy *Lucía* de Find Your Rival.\n\n` +
    `*${opts.solicitanteNombre}* quiere jugar un partido de *${opts.deporte}* ` +
    `(nivel ${opts.nivel}) y encontramos que serían buenos rivales.\n\n` +
    `¿Estás disponible? Responde *SÍ* o *NO* 🏆`;

  const enviado = await enviarMensajeTwilio(opts.rivalTelefono, mensaje);

  if (!enviado) {
    logger.warn(`No se pudo contactar al rival ${opts.rivalNombre} (${opts.rivalTelefono})`);
    return false;
  }

  // Marcar solicitud: rival identificado, esperando su confirmación
  await actualizarSolicitud(opts.solicitudId, {
    rival_nombre:              opts.rivalNombre,
    rival_telefono:            opts.rivalTelefono,
    rival_encontrado:          true,
    estado:                    'rival_encontrado',
    rival_confirmacion_estado: 'esperando',
    busqueda_activa:           false,
  });

  logger.info(`Rival contactado (job): ${opts.rivalNombre} para solicitud #${opts.solicitudId}`);
  return true;
}

async function intentarMatchSolicitud(sol: Solicitud): Promise<boolean> {
  const deporte  = sol.deporte as DeporteTipo;
  const esFutbol = deporte === 'fútbol';

  const resultado = await buscarRival({
    deporte,
    nivel_futbol:         esFutbol  ? sol.nivel as NivelFutbol : undefined,
    nivel_padel:          !esFutbol ? sol.nivel as NivelPadel  : undefined,
    franja:               sol.horario_deseado ?? undefined,
    telefono_solicitante: sol.telefono,
  });

  if (!resultado.encontrado || resultado.candidatos.length === 0) return false;

  const rival = resultado.candidatos[0];

  // Validar que el rival tenga teléfono antes de continuar
  if (!rival.telefono) {
    logger.warn(`Rival ${rival.nombre} sin teléfono — omitiendo`);
    return false;
  }

  // Contactar al rival y actualizar solicitud
  // Si falla el contacto, no rompemos el job — simplemente no avanzamos
  try {
    const contactado = await contactarRivalJob({
      solicitudId:       sol.id,
      rivalNombre:       rival.nombre,
      rivalTelefono:     rival.telefono,
      solicitanteNombre: sol.nombre,
      deporte:           deporte,
      nivel:             sol.nivel,
    });

    if (!contactado) return false;

    // Notificar al solicitante que encontramos rival y estamos esperando confirmación
    await sendWhatsAppMessage(
      sol.telefono,
      `🔍 *Rival encontrado*\n\n` +
      `Hola ${sol.nombre}, encontramos a *${rival.nombre}* como posible rival ` +
      `para tu partido de ${deporte} (nivel ${sol.nivel}).\n\n` +
      `Le enviamos un mensaje para confirmar su disponibilidad. ` +
      `Te avisamos en cuanto responda. ⏳`
    );

    return true;
  } catch (err: any) {
    // El job nunca debe romperse por un fallo al contactar un rival
    logger.error(`Error contactando rival en job (solicitud #${sol.id})`, {
      err: err?.message ?? String(err),
    });
    return false;
  }
}

// Job principal: busca rivals para solicitudes pendientes (cada 5 minutos)
export async function jobMatchmaker(): Promise<void> {
  try {
    const pendientes = await obtenerSolicitudesPendientesBusqueda();

    if (pendientes.length === 0) return;

    logger.info(`Job matchmaker: ${pendientes.length} solicitud(es) pendiente(s)`);

    for (const sol of pendientes) {
      try {
        if (sol.estado === 'pendiente') {
          await actualizarSolicitud(sol.id, { estado: 'buscando_rival' });
        }
        await intentarMatchSolicitud(sol);
      } catch (err: any) {
        // Error en una solicitud individual no detiene el resto del job
        logger.error(`Error procesando solicitud #${sol.id} en job matchmaker`, {
          err: err?.message ?? String(err),
        });
      }
    }
  } catch (err: any) {
    logger.error('Error en job matchmaker', { err: err?.message ?? String(err) });
  }
}

// Job vencidos: notifica a usuarios sin rival después de 2 horas (cada 15 minutos)
export async function jobNotificarSinRival(): Promise<void> {
  try {
    const vencidas = await obtenerSolicitudesVencidas();

    if (vencidas.length === 0) return;

    logger.info(`Job sin rival: ${vencidas.length} solicitud(es) vencida(s)`);

    for (const sol of vencidas) {
      try {
        await enviarNotificacionSinRival(sol.telefono, sol.deporte);
        await actualizarSolicitud(sol.id, {
          notificado_sin_rival: true,
          busqueda_activa:      false,
        });
      } catch (err: any) {
        logger.error(`Error notificando solicitud vencida #${sol.id}`, {
          err: err?.message ?? String(err),
        });
      }
    }
  } catch (err: any) {
    logger.error('Error en job sin rival', { err: err?.message ?? String(err) });
  }
}

export function iniciarJobsMatchmaking(): { matchmaker: NodeJS.Timeout; sinRival: NodeJS.Timeout } {
  logger.info('Jobs matchmaking iniciados (matchmaker: 5min, sin rival: 15min)');
  return {
    matchmaker: setInterval(jobMatchmaker,        5 * 60 * 1000),
    sinRival:   setInterval(jobNotificarSinRival, 15 * 60 * 1000),
  };
}
