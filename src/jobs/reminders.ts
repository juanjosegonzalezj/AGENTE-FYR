import { obtenerReservasParaRecordatorio, marcarRecordatorioEnviado } from '../db/queries/reservas.js';
import { enviarRecordatorioPartido } from '../integrations/whatsapp/sender.js';
import logger from '../utils/logger.js';

// Ejecutar cada minuto — envía recordatorios 45 min antes del partido
export async function jobRecordatorios(): Promise<void> {
  try {
    const reservas = await obtenerReservasParaRecordatorio();

    if (reservas.length === 0) return;

    logger.info(`Job recordatorios: ${reservas.length} reserva(s) por notificar`);

    for (const reserva of reservas) {
      // Enviar a capitán 1
      await enviarRecordatorioPartido(reserva.telefono_1, {
        deporte:     reserva.deporte,
        cancha:      reserva.cancha,
        fecha:       reserva.fecha,
        hora_inicio: reserva.hora_inicio,
        hora_fin:    reserva.hora_fin,
        rival:       reserva.capitan_2,
      });

      // Enviar a capitán 2
      await enviarRecordatorioPartido(reserva.telefono_2, {
        deporte:     reserva.deporte,
        cancha:      reserva.cancha,
        fecha:       reserva.fecha,
        hora_inicio: reserva.hora_inicio,
        hora_fin:    reserva.hora_fin,
        rival:       reserva.capitan_1,
      });

      await marcarRecordatorioEnviado(reserva.id);
      logger.info(`Recordatorio enviado: reserva #${reserva.id}`);
    }
  } catch (err: any) {
    logger.error('Error en job recordatorios', { err: err.message });
  }
}

export function iniciarJobRecordatorios(): NodeJS.Timeout {
  logger.info('Job recordatorios iniciado (cada 1 minuto)');
  return setInterval(jobRecordatorios, 60 * 1000);
}
