import {
  obtenerSolicitudesPendientesBusqueda,
  obtenerSolicitudesVencidas,
  actualizarSolicitud,
} from '../db/queries/solicitudes.js';
import { buscarRival } from '../ai/tools/matchmaking.js';
import { enviarNotificacionSinRival } from '../integrations/whatsapp/sender.js';
import { sendWhatsAppMessage } from '../integrations/whatsapp/sender.js';
import type { Solicitud, DeporteTipo, NivelFutbol, NivelPadel } from '../types/index.js';
import logger from '../utils/logger.js';

async function intentarMatchSolicitud(sol: Solicitud): Promise<boolean> {
  const deporte = sol.deporte as DeporteTipo;
  const esFutbol = deporte === 'fútbol';

  const resultado = await buscarRival({
    deporte,
    nivel_futbol:         esFutbol ? sol.nivel as NivelFutbol : undefined,
    nivel_padel:          !esFutbol ? sol.nivel as NivelPadel : undefined,
    franja:               sol.horario_deseado ?? undefined,
    telefono_solicitante: sol.telefono,
  });

  if (!resultado.encontrado || resultado.candidatos.length === 0) return false;

  const rival = resultado.candidatos[0];

  // Actualizar solicitud con rival encontrado
  await actualizarSolicitud(sol.id, {
    estado:           'rival_encontrado',
    rival_encontrado: true,
    rival_nombre:     rival.nombre,
    rival_telefono:   rival.telefono,
    busqueda_activa:  false,
  });

  // Notificar al solicitante
  await sendWhatsAppMessage(
    sol.telefono,
    `🎯 *¡Rival encontrado!*\n\n` +
    `Hola ${sol.nombre}, encontramos un rival compatible:\n\n` +
    `👤 Rival: ${rival.nombre}\n` +
    `⚽ Deporte: ${sol.deporte}\n` +
    `📊 Nivel: ${esFutbol ? rival.nivel_futbol : rival.nivel_padel}\n\n` +
    `¿Quieres confirmar el partido? Dime un horario y lo reservamos. 💪`
  );

  logger.info(`Match automático: ${sol.nombre} ↔ ${rival.nombre}`);
  return true;
}

// Job principal: busca rivals para solicitudes pendientes (cada 5 minutos)
export async function jobMatchmaker(): Promise<void> {
  try {
    const pendientes = await obtenerSolicitudesPendientesBusqueda();

    if (pendientes.length === 0) return;

    logger.info(`Job matchmaker: ${pendientes.length} solicitud(es) pendiente(s)`);

    for (const sol of pendientes) {
      // Marcar como buscando
      if (sol.estado === 'pendiente') {
        await actualizarSolicitud(sol.id, { estado: 'buscando_rival' });
      }

      await intentarMatchSolicitud(sol);
    }
  } catch (err: any) {
    logger.error('Error en job matchmaker', { err: err.message });
  }
}

// Job vencidos: notifica a usuarios sin rival después de 2 horas (cada 15 minutos)
export async function jobNotificarSinRival(): Promise<void> {
  try {
    const vencidas = await obtenerSolicitudesVencidas();

    if (vencidas.length === 0) return;

    logger.info(`Job sin rival: ${vencidas.length} solicitud(es) vencida(s)`);

    for (const sol of vencidas) {
      await enviarNotificacionSinRival(sol.telefono, sol.deporte);
      await actualizarSolicitud(sol.id, {
        notificado_sin_rival: true,
        busqueda_activa:      false, // Dejar de buscar activamente
      });
    }
  } catch (err: any) {
    logger.error('Error en job sin rival', { err: err.message });
  }
}

export function iniciarJobsMatchmaking(): { matchmaker: NodeJS.Timeout; sinRival: NodeJS.Timeout } {
  logger.info('Jobs matchmaking iniciados (matchmaker: 5min, sin rival: 15min)');
  return {
    matchmaker: setInterval(jobMatchmaker,       5 * 60 * 1000),
    sinRival:   setInterval(jobNotificarSinRival, 15 * 60 * 1000),
  };
}
