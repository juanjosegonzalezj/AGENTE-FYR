import type Anthropic from '@anthropic-ai/sdk';

export const TOOL_DEFINITIONS: Anthropic.Tool[] = [
  {
    name: 'registrar_solicitud',
    description:
      'Registra una nueva solicitud de matchmaking en la base de datos. ' +
      'Llama esta herramienta después de recopilar nombre, teléfono, deporte, nivel y horario del usuario.',
    input_schema: {
      type: 'object',
      properties: {
        nombre:          { type: 'string', description: 'Nombre y apellido del jugador.' },
        telefono:        { type: 'string', description: 'Número de teléfono del jugador (sin código país si ya lo tienes).' },
        deporte:         { type: 'string', enum: ['fútbol', 'pádel'], description: 'Deporte.' },
        nivel:           { type: 'string', description: 'Nivel: Bajo/Intermedio/Alto para fútbol. 1ra/2da/3ra/4ta/5ta para pádel.' },
        horario_deseado: { type: 'string', description: 'Franja horaria preferida (ej: "6am-9am", "6pm-9pm").' },
        observaciones:   { type: 'string', description: 'Notas adicionales opcionales.' },
      },
      required: ['nombre', 'telefono', 'deporte', 'nivel'],
    },
  },
  {
    name: 'buscar_rival',
    description:
      'Busca un rival compatible usando las reglas de matchmaking de FYR. ' +
      'Prioridad: Capitanes FYR → Clientes complejo → Solicitudes pendientes. ' +
      'SIEMPRE usa esta herramienta para buscar rivales, nunca inventes.',
    input_schema: {
      type: 'object',
      properties: {
        deporte:              { type: 'string', enum: ['fútbol', 'pádel'] },
        nivel_futbol:         { type: 'string', enum: ['Bajo', 'Intermedio', 'Alto'], description: 'Solo si deporte es fútbol.' },
        nivel_padel:          { type: 'string', enum: ['1ra', '2da', '3ra', '4ta', '5ta'], description: 'Solo si deporte es pádel.' },
        franja_horaria:       { type: 'string', description: 'Franja horaria preferida (ej: "6am-9am").' },
        telefono_solicitante: { type: 'string', description: 'Teléfono del usuario que busca rival (para excluirlo de resultados).' },
      },
      required: ['deporte', 'telefono_solicitante'],
    },
  },
  {
    name: 'consultar_disponibilidad',
    description:
      'Consulta los horarios disponibles en Google Calendar para una fecha específica. ' +
      'SIEMPRE llama esta herramienta antes de proponer horarios. Nunca inventes disponibilidad.',
    input_schema: {
      type: 'object',
      properties: {
        fecha: { type: 'string', description: 'Fecha en formato YYYY-MM-DD.' },
      },
      required: ['fecha'],
    },
  },
  {
    name: 'crear_reserva',
    description:
      'Crea una reserva de cancha después de que AMBOS jugadores hayan confirmado y el horario esté disponible. ' +
      'Crea también el evento en Google Calendar.',
    input_schema: {
      type: 'object',
      properties: {
        capitan_1:       { type: 'string', description: 'Nombre del capitán 1 (quien solicita).' },
        capitan_2:       { type: 'string', description: 'Nombre del capitán 2 (el rival).' },
        telefono_1:      { type: 'string', description: 'Teléfono capitán 1.' },
        telefono_2:      { type: 'string', description: 'Teléfono capitán 2.' },
        deporte:         { type: 'string', enum: ['fútbol', 'pádel'] },
        fecha:           { type: 'string', description: 'Fecha del partido YYYY-MM-DD.' },
        hora_inicio:     { type: 'string', description: 'Hora de inicio HH:MM.' },
        hora_fin:        { type: 'string', description: 'Hora de fin HH:MM.' },
        solicitud_1_id:  { type: 'number', description: 'ID de la solicitud del capitán 1 (si existe).' },
        solicitud_2_id:  { type: 'number', description: 'ID de la solicitud del capitán 2 (si existe).' },
      },
      required: ['capitan_1', 'capitan_2', 'telefono_1', 'telefono_2', 'deporte', 'fecha', 'hora_inicio', 'hora_fin'],
    },
  },
  {
    name: 'confirmar_pago',
    description:
      'Confirma el pago de una reserva. Llama esta herramienta cuando el usuario diga que ya pagó o envíe comprobante. ' +
      'Cambia estado_pago a confirmado y estado_reserva a reservada.',
    input_schema: {
      type: 'object',
      properties: {
        reserva_id:       { type: 'number', description: 'ID de la reserva a confirmar.' },
        telefono_usuario:  { type: 'string', description: 'Teléfono del usuario (para buscar la reserva si no tienes el ID).' },
      },
      required: ['telefono_usuario'],
    },
  },
  {
    name: 'obtener_reserva',
    description: 'Obtiene los detalles de la reserva activa de un usuario por su teléfono.',
    input_schema: {
      type: 'object',
      properties: {
        telefono: { type: 'string', description: 'Teléfono del usuario.' },
      },
      required: ['telefono'],
    },
  },
  {
    name: 'cancelar_reserva',
    description: 'Cancela una reserva existente y elimina el evento de Google Calendar.',
    input_schema: {
      type: 'object',
      properties: {
        reserva_id:       { type: 'number', description: 'ID de la reserva.' },
        telefono_usuario: { type: 'string', description: 'Teléfono (para buscar si no tienes el ID).' },
      },
      required: ['telefono_usuario'],
    },
  },
  {
    name: 'obtener_solicitud',
    description: 'Obtiene la solicitud activa de un usuario por su teléfono.',
    input_schema: {
      type: 'object',
      properties: {
        telefono: { type: 'string', description: 'Teléfono del usuario.' },
      },
      required: ['telefono'],
    },
  },
];
