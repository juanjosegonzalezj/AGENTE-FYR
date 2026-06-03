// Legacy sender — redirige todo al sender de Twilio
// Los jobs (reminders, matchmaker) importan desde aquí por compatibilidad.
import { enviarMensajeTwilio, enviarRecordatorioTwilio } from '../twilio/sender.js';

export async function sendWhatsAppMessage(to: string, message: string): Promise<boolean> {
  return enviarMensajeTwilio(to, message);
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
  return enviarRecordatorioTwilio(telefono, detalles);
}

export async function enviarNotificacionSinRival(
  telefono: string,
  deporte: string
): Promise<boolean> {
  return enviarMensajeTwilio(
    telefono,
    `Hola, llevamos 2 horas buscando un rival compatible para tu partido de ${deporte}.\n\n` +
    `Por ahora no encontramos a nadie disponible. Te avisaremos en cuanto aparezca un rival. 🙏\n\n` +
    `Si quieres cambiar tu horario o deporte, respóndeme aquí.`
  );
}
