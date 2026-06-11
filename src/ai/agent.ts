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
import { verificarRegistroTelefono, insertarCapitan } from '../db/queries/capitanes.js';
import { obtenerOCrearConversacion, agregarMensajes } from '../db/queries/conversaciones.js';
import { procesarOnboarding, onboardingTerminado, MSG_CONFIRMACION } from './onboarding.js';
import type { MensajeIA, DeporteTipo, NivelFutbol, NivelPadel } from '../types/index.js';
import logger from '../utils/logger.js';

const anthropic = new Anthropic({ apiKey: config.ANTHROPIC_API_KEY });

const MODEL        = 'claude-sonnet-4-6';
const MAX_TOKENS   = 350; // WhatsApp: respuestas cortas, una pregunta por turno
const MAX_ROUNDS   = 8;

// ── Ejecutor de herramientas ──────────────────────────────────────────────────

async function ejecutarHerramienta(
  nombre: string,
  input: Record<string, unknown>
): Promise<string> {
  try {
    switch (nombre) {

      case 'registrar_solicitud': {
        const { solicitud: sol, esDuplicado } = await crearSolicitud({
          nombre:          input.nombre as string,
          telefono:        input.telefono as string,
          deporte:         input.deporte as DeporteTipo,
          nivel:           input.nivel as string,
          horario_deseado: input.horario_deseado as string | undefined,
          observaciones:   input.observaciones as string | undefined,
        });
        if (esDuplicado) {
          return JSON.stringify({
            ok: true,
            solicitud_id: sol.id,
            esDuplicado: true,
            estado_actual: sol.estado,
            mensaje: `Ya tienes una solicitud activa (ID: ${sol.id}, estado: ${sol.estado}). Continuamos con ella en lugar de crear una nueva.`,
          });
        }
        return JSON.stringify({
          ok: true,
          solicitud_id: sol.id,
          esDuplicado: false,
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

        if (!resultado.encontrado || resultado.candidatos.length === 0) {
          return JSON.stringify({
            encontrado: false,
            instruccion_lucia: 'Di al usuario exactamente esto: "Ya les escribí a los rivales disponibles y estoy esperando su respuesta. Te aviso en cuanto confirmen. ⏳" — NO digas que no hay rivales. La búsqueda continúa automáticamente.',
          });
        }

        // Ocultar nombre/teléfono del rival — solo se revelan cuando confirme.
        // Se exponen como campos PRIVADO para que el agente los use en contactar_rival
        // sin mostrarlos al usuario.
        const candidatosFiltrados = resultado.candidatos.map((c, i) => ({
          rival_index:            i,
          rival_nombre_PRIVADO:   c.nombre,
          rival_telefono_PRIVADO: c.telefono,
          deporte:                c.sport_type,
          nivel_futbol:           c.nivel_futbol,
          nivel_padel:            c.nivel_padel,
          franjas:                c.franja_horaria,
          fuente:                 c.fuente,
        }));

        return JSON.stringify({
          encontrado: true,
          mensaje:    resultado.mensaje,
          candidatos: candidatosFiltrados,
          instruccion: 'NO reveles el nombre ni teléfono del rival al usuario. Usa rival_nombre_PRIVADO y rival_telefono_PRIVADO solo para llamar a contactar_rival.',
        });
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
          `Hola. Encontramos un jugador compatible para jugar *${deporte}* en la franja horaria seleccionada. ` +
          `¿Te gustaría participar?\n\n1. Sí\n2. No`;

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

      case 'verificar_registro': {
        const tel = input.telefono as string;
        const fuente = await verificarRegistroTelefono(tel);
        if (fuente) {
          return JSON.stringify({ registrado: true, fuente, mensaje: `Usuario registrado en ${fuente}.` });
        }
        return JSON.stringify({
          registrado: false,
          mensaje: 'Usuario NO registrado. Debes pedirle los datos y registrarlo en Capitanes antes de continuar.',
        });
      }

      case 'registrar_en_capitanes': {
        const capitan = await insertarCapitan({
          nombre_capitan: input.nombre_capitan as string,
          telefono:       input.telefono       as string,
          sport_type:     input.sport_type     as any,
          nivel_futbol:   (input.nivel_futbol  as any) ?? 'Intermedio',
          nivel_padel:    (input.nivel_padel   as any) ?? '3ra',
          franja_horaria: input.franja_horaria as string[],
        });
        return JSON.stringify({
          ok: true,
          capitan_id: capitan.id,
          mensaje: `${capitan.nombre_capitan} registrado correctamente en la base de Capitanes.`,
        });
      }

      case 'cancelar_mi_reserva': {
        const telUsuario = input.telefono_usuario as string;
        const reserva = await obtenerReservaPorTelefono(telUsuario);

        if (!reserva) {
          return JSON.stringify({ ok: false, mensaje: 'No tienes una reserva activa para cancelar.' });
        }

        const reservaCancelada = await cancelarReserva(reserva.id);

        // Eliminar evento de Google Calendar
        if (reservaCancelada.google_calendar_event_id) {
          await eliminarEventoCalendario(reservaCancelada.google_calendar_event_id);
        }

        // Identificar al rival y notificarlo
        const esCapitan1     = reservaCancelada.telefono_1 === telUsuario;
        const telefonoRival  = esCapitan1 ? reservaCancelada.telefono_2 : reservaCancelada.telefono_1;
        const nombreCancela  = esCapitan1 ? reservaCancelada.capitan_1  : reservaCancelada.capitan_2;
        const nombreRival    = esCapitan1 ? reservaCancelada.capitan_2  : reservaCancelada.capitan_1;

        await enviarMensajeTwilio(
          telefonoRival,
          `😕 *Partido cancelado*\n\n` +
          `Lo sentimos, *${nombreCancela}* canceló el partido del *${reservaCancelada.fecha}* ` +
          `a las *${reservaCancelada.hora_inicio}*.\n\n` +
          `¿Quieres que busquemos otro rival para ti? Responde *SÍ* o *NO*.`
        );

        return JSON.stringify({
          ok: true,
          reserva_id:      reservaCancelada.id,
          rival_notificado: nombreRival,
          mensaje: `Reserva #${reservaCancelada.id} cancelada. ${nombreRival} fue notificado y se le preguntó si quiere seguir buscando rival.`,
        });
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
  const esConversacionNueva = !conv.mensajes || conv.mensajes.length === 0;

  // Primer mensaje: saludo hardcodeado exacto
  if (esConversacionNueva) {
    const saludo =
      `Hola, soy Lucía, la asistente virtual de Find Your Rival. ` +
      `Te ayudaré a encontrar un rival compatible para jugar. ` +
      `¿Cuál es tu nombre completo?`;
    await agregarMensajes(telefono, [
      { role: 'user',      content: mensajeUsuario },
      { role: 'assistant', content: saludo },
    ]);
    return { reply: saludo, herramientas_usadas: [] };
  }

  const historial: MensajeIA[] = [...(conv.mensajes ?? [])];
  const nuevoMensaje: MensajeIA = { role: 'user', content: mensajeUsuario };
  historial.push(nuevoMensaje);

  // 2. State machine de onboarding (hardcodeado — no pasa por Claude)
  if (!onboardingTerminado(historial)) {
    const resultado = procesarOnboarding(historial);

    if (!resultado.completo) {
      // Próxima pregunta del flujo de registro
      await agregarMensajes(telefono, [nuevoMensaje, { role: 'assistant', content: resultado.respuesta }]);
      return { reply: resultado.respuesta, herramientas_usadas: [] };
    }

    // Onboarding completo: registrar al usuario y pasar a Claude con contexto
    const { datos } = resultado;
    logger.info(`Onboarding completo para ${telefono}`, datos);

    // Verificar si ya está registrado; si no, registrar en Capitanes
    const yaRegistrado = await verificarRegistroTelefono(datos.telefono ?? telefono);
    if (!yaRegistrado) {
      await insertarCapitan({
        nombre_capitan: datos.nombre!,
        telefono:       datos.telefono ?? telefono,
        sport_type:     datos.deporte! as any,
        nivel_futbol:   (datos.deporte === 'fútbol' ? datos.nivel : 'Intermedio') as any,
        nivel_padel:    (datos.deporte === 'pádel'  ? datos.nivel : '3ra') as any,
        franja_horaria: datos.franjas ?? [],
      });
    }

    // Registrar solicitud automáticamente y pasar a búsqueda
    const { solicitud } = await crearSolicitud({
      nombre:          datos.nombre!,
      telefono:        datos.telefono ?? telefono,
      deporte:         datos.deporte!,
      nivel:           datos.nivel!,
      horario_deseado: datos.franjas?.join(', '),
    });

    const confirmacion = MSG_CONFIRMACION;
    await agregarMensajes(telefono, [nuevoMensaje, { role: 'assistant', content: confirmacion }]);
    return { reply: confirmacion, herramientas_usadas: ['registrar_solicitud'] };
  }

  // 3. System prompt de Lucía (solo para conversaciones post-onboarding)
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
