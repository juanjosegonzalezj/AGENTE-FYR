import Anthropic from '@anthropic-ai/sdk';
import { config } from '../config/index.js';
import { buildSystemPrompt } from './prompts.js';
import { TOOL_DEFINITIONS } from './tools/index.js';
import { buscarRival } from './tools/matchmaking.js';
import { consultarDisponibilidad } from '../integrations/google-calendar/availability.js';
import { crearEventoCalendario, eliminarEventoCalendario } from '../integrations/google-calendar/events.js';
import { crearSolicitud, actualizarSolicitud, obtenerSolicitudPorTelefono } from '../db/queries/solicitudes.js';
import { enviarMensajeTwilio } from '../integrations/twilio/sender.js';
import { crearReserva, confirmarPago, obtenerReservaPorTelefono, obtenerReservaPorId, cancelarReserva, actualizarReserva } from '../db/queries/reservas.js';
import { obtenerOCrearConversacion, agregarMensajes } from '../db/queries/conversaciones.js';
import type { MensajeIA, DeporteTipo, NivelFutbol, NivelPadel } from '../types/index.js';
import logger from '../utils/logger.js';

const anthropic = new Anthropic({ apiKey: config.ANTHROPIC_API_KEY });

const MODEL        = 'claude-sonnet-4-6';
const MAX_TOKENS   = 1024;
const MAX_ROUNDS   = 8;

// ── Ejecutor de herramientas ──────────────────────────────────────────────────

async function ejecutarHerramienta(
  nombre: string,
  input: Record<string, unknown>
): Promise<string> {
  try {
    switch (nombre) {

      case 'registrar_solicitud': {
        const sol = await crearSolicitud({
          nombre:          input.nombre as string,
          telefono:        input.telefono as string,
          deporte:         input.deporte as DeporteTipo,
          nivel:           input.nivel as string,
          horario_deseado: input.horario_deseado as string | undefined,
          observaciones:   input.observaciones as string | undefined,
        });
        return JSON.stringify({
          ok: true,
          solicitud_id: sol.id,
          mensaje: `Solicitud registrada correctamente (ID: ${sol.id}).`,
        });
      }

      case 'buscar_rival': {
        const resultado = await buscarRival({
          deporte:              input.deporte as DeporteTipo,
          nivel_futbol:         input.nivel_futbol as NivelFutbol | undefined,
          nivel_padel:          input.nivel_padel  as NivelPadel  | undefined,
          franja:               input.franja_horaria as string | undefined,
          telefono_solicitante: input.telefono_solicitante as string,
        });
        return JSON.stringify(resultado);
      }

      case 'consultar_disponibilidad': {
        const slots = await consultarDisponibilidad(input.fecha as string);
        const disponibles = slots.filter(s => s.disponible);
        return JSON.stringify({
          fecha:           input.fecha,
          slots_libres:    disponibles.map(s => `${s.inicio} – ${s.fin}`),
          total_disponibles: disponibles.length,
        });
      }

      case 'crear_reserva': {
        const deporte = input.deporte as DeporteTipo;
        const cancha  = deporte === 'fútbol' ? config.COMPLEX_CANCHA_FUTBOL : config.COMPLEX_CANCHA_PADEL;
        const valor   = deporte === 'fútbol'
          ? Number(config.COMPLEX_VALOR_FUTBOL)
          : Number(config.COMPLEX_VALOR_PADEL);

        // Crear evento en Google Calendar
        const fechaHoraInicio = `${input.fecha}T${input.hora_inicio}:00`;
        const fechaHoraFin    = `${input.fecha}T${input.hora_fin}:00`;
        const eventId = await crearEventoCalendario({
          titulo:      `FYR – ${deporte} – ${input.capitan_1} vs ${input.capitan_2}`,
          descripcion: `Partido organizado por Find Your Rival.\nCancha: ${cancha}`,
          inicio:      fechaHoraInicio,
          fin:         fechaHoraFin,
          deporte,
        });

        const reserva = await crearReserva({
          solicitud_1_id:          input.solicitud_1_id as number | undefined,
          solicitud_2_id:          input.solicitud_2_id as number | undefined,
          capitan_1:               input.capitan_1  as string,
          capitan_2:               input.capitan_2  as string,
          telefono_1:              input.telefono_1 as string,
          telefono_2:              input.telefono_2 as string,
          deporte,
          cancha,
          fecha:                   input.fecha       as string,
          hora_inicio:             input.hora_inicio as string,
          hora_fin:                input.hora_fin    as string,
          valor_total:             valor,
          google_calendar_event_id: eventId ?? undefined,
        });

        return JSON.stringify({
          ok: true,
          reserva_id:  reserva.id,
          cancha,
          fecha:       reserva.fecha,
          hora_inicio: reserva.hora_inicio,
          hora_fin:    reserva.hora_fin,
          valor_total: valor,
          estado_pago: 'pendiente_pago',
          mensaje: `Reserva creada (ID: ${reserva.id}). Valor: $${valor.toLocaleString('es-CO')} COP. Pendiente de pago.`,
        });
      }

      case 'confirmar_pago': {
        let reserva = input.reserva_id
          ? await obtenerReservaPorId(input.reserva_id as number)
          : await obtenerReservaPorTelefono(input.telefono_usuario as string);

        if (!reserva) {
          return JSON.stringify({ ok: false, mensaje: 'No encontré una reserva activa para este usuario.' });
        }
        if (reserva.estado_pago === 'confirmado') {
          return JSON.stringify({ ok: false, mensaje: 'Esta reserva ya está pagada y confirmada.' });
        }

        const actualizada = await confirmarPago(reserva.id);
        return JSON.stringify({
          ok: true,
          reserva_id:     actualizada.id,
          estado_pago:    actualizada.estado_pago,
          estado_reserva: actualizada.estado_reserva,
          mensaje: `✅ Pago confirmado. Reserva #${actualizada.id} está CONFIRMADA. Partido el ${actualizada.fecha} de ${actualizada.hora_inicio} a ${actualizada.hora_fin} en ${actualizada.cancha}.`,
        });
      }

      case 'obtener_reserva': {
        const reserva = await obtenerReservaPorTelefono(input.telefono as string);
        if (!reserva) {
          return JSON.stringify({ encontrado: false, mensaje: 'No tienes una reserva activa.' });
        }
        return JSON.stringify({ encontrado: true, reserva });
      }

      case 'cancelar_reserva': {
        let reserva = input.reserva_id
          ? await obtenerReservaPorId(input.reserva_id as number)
          : await obtenerReservaPorTelefono(input.telefono_usuario as string);

        if (!reserva) {
          return JSON.stringify({ ok: false, mensaje: 'No encontré una reserva activa.' });
        }

        await cancelarReserva(reserva.id);

        if (reserva.google_calendar_event_id) {
          await eliminarEventoCalendario(reserva.google_calendar_event_id);
        }

        return JSON.stringify({
          ok: true,
          mensaje: `Reserva #${reserva.id} cancelada correctamente.`,
        });
      }

      case 'contactar_rival': {
        const solicitudId    = input.solicitud_id as number;
        const rivalNombre    = input.rival_nombre as string;
        const rivalTelefono  = input.rival_telefono as string;
        const solNombre      = input.solicitante_nombre as string;
        const deporte        = input.deporte as string;
        const nivel          = input.nivel as string;
        const fecha          = input.fecha_propuesta as string | undefined;
        const hora           = input.hora_propuesta  as string | undefined;

        const fechaTexto = fecha && hora ? ` para el *${fecha} a las ${hora}*` : '';

        const mensajeRival =
          `Hola ${rivalNombre} 👋 Soy *Lucía* de Find Your Rival.\n\n` +
          `*${solNombre}* quiere jugar un partido de *${deporte}* (nivel ${nivel})${fechaTexto} y encontramos que serían buenos rivales.\n\n` +
          `¿Estás disponible? Responde *SÍ* o *NO* 🏆`;

        await enviarMensajeTwilio(rivalTelefono, mensajeRival);

        // Actualizar solicitud: rival encontrado, esperando confirmación
        await actualizarSolicitud(solicitudId, {
          rival_nombre:              rivalNombre,
          rival_telefono:            rivalTelefono,
          rival_encontrado:          true,
          estado:                    'rival_encontrado',
          rival_confirmacion_estado: 'esperando',
          busqueda_activa:           false,
        });

        return JSON.stringify({
          ok: true,
          mensaje: `Mensaje enviado a ${rivalNombre} (${rivalTelefono}). Esperando su respuesta. Le avisaré al solicitante cuando confirme.`,
        });
      }

      case 'obtener_solicitud': {
        const sol = await obtenerSolicitudPorTelefono(input.telefono as string);
        if (!sol) {
          return JSON.stringify({ encontrado: false, mensaje: 'No tienes una solicitud activa.' });
        }
        return JSON.stringify({ encontrado: true, solicitud: sol });
      }

      default:
        return JSON.stringify({ error: `Herramienta desconocida: ${nombre}` });
    }
  } catch (err: any) {
    logger.error(`Error ejecutando herramienta ${nombre}`, { err: err.message });
    return JSON.stringify({ error: `Error interno: ${err.message}` });
  }
}

// ── Loop principal del agente ─────────────────────────────────────────────────

export interface AgentResponse {
  reply: string;
  herramientas_usadas: string[];
}

export async function runAgent(
  mensajeUsuario: string,
  telefono: string
): Promise<AgentResponse> {
  // 1. Cargar historial de conversación
  const conv = await obtenerOCrearConversacion(telefono);
  const historial: MensajeIA[] = [...(conv.mensajes ?? [])];
  const nuevoMensaje: MensajeIA = { role: 'user', content: mensajeUsuario };
  historial.push(nuevoMensaje);

  // 2. System prompt de Lucía
  const systemPrompt = buildSystemPrompt(telefono);

  // 3. Loop agéntico
  const herramientasUsadas: string[] = [];
  let mensajesActuales: Anthropic.MessageParam[] = historial.map(m => ({
    role: m.role,
    content: typeof m.content === 'string' ? m.content : m.content as Anthropic.ContentBlockParam[],
  }));

  for (let ronda = 0; ronda < MAX_ROUNDS; ronda++) {
    logger.debug(`Ronda ${ronda + 1}`, { telefono });

    const response = await anthropic.messages.create({
      model:      MODEL,
      max_tokens: MAX_TOKENS,
      system:     systemPrompt,
      tools:      TOOL_DEFINITIONS,
      messages:   mensajesActuales,
    });

    if (response.stop_reason === 'end_turn') {
      const textBlock = response.content.find(b => b.type === 'text');
      const reply = textBlock?.type === 'text' ? textBlock.text : '¿En qué más puedo ayudarte?';

      await agregarMensajes(telefono, [nuevoMensaje, { role: 'assistant', content: reply }]);
      return { reply, herramientas_usadas: herramientasUsadas };
    }

    if (response.stop_reason === 'tool_use') {
      const toolBlocks = response.content.filter(b => b.type === 'tool_use');
      const resultados: Anthropic.ToolResultBlockParam[] = [];

      for (const block of toolBlocks) {
        if (block.type !== 'tool_use') continue;
        herramientasUsadas.push(block.name);
        logger.info(`Herramienta: ${block.name}`, { input: block.input });

        const resultado = await ejecutarHerramienta(
          block.name,
          block.input as Record<string, unknown>
        );

        resultados.push({
          type:        'tool_result',
          tool_use_id: block.id,
          content:     resultado,
        });
      }

      mensajesActuales = [
        ...mensajesActuales,
        { role: 'assistant', content: response.content },
        { role: 'user',      content: resultados },
      ] as Anthropic.MessageParam[];

      continue;
    }

    break;
  }

  const fallback = 'Lo siento, tuve un problema procesando tu mensaje. Intenta de nuevo.';
  await agregarMensajes(telefono, [nuevoMensaje, { role: 'assistant', content: fallback }]);
  return { reply: fallback, herramientas_usadas: herramientasUsadas };
}
