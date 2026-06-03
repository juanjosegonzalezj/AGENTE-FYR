// ─────────────────────────────────────────────────────────────────────────────
// Find Your Rival – Lucía Types (Pereira, Fútbol + Pádel)
// ─────────────────────────────────────────────────────────────────────────────

export type DeporteTipo  = 'fútbol' | 'pádel' | 'ambos';
export type NivelFutbol  = 'Bajo' | 'Intermedio' | 'Alto';
export type NivelPadel   = '1ra' | '2da' | '3ra' | '4ta' | '5ta';

export type EstadoSolicitud =
  | 'pendiente'
  | 'buscando_rival'
  | 'rival_encontrado'
  | 'pendiente_pago'
  | 'reservado'
  | 'completado'
  | 'cancelado';

export type EstadoReserva = 'pendiente' | 'reservada' | 'cancelada' | 'completada';
export type EstadoPago    = 'pendiente_pago' | 'confirmado';
export type EstadoMatch   = 'pendiente_pago' | 'confirmado' | 'cancelado' | 'jugado';

// ── Tablas principales ────────────────────────────────────────────────────────

export interface Capitan {
  id: number;
  created_at: string;
  nombre_capitan: string;
  telefono: string | null;
  sport_type: DeporteTipo;
  franja_horaria: string[];
  nivel_futbol: NivelFutbol;
  nivel_padel: NivelPadel;
}

export type Cliente = Capitan; // mismo schema, fuente distinta

export interface Solicitud {
  id: number;
  fecha_solicitud: string;
  nombre: string;
  telefono: string;
  deporte: DeporteTipo;
  nivel: string;
  horario_deseado: string | null;
  estado: EstadoSolicitud | string;
  rival_encontrado: boolean;
  rival_nombre: string | null;
  rival_telefono: string | null;
  fecha_match: string | null;
  observaciones: string | null;
  busqueda_activa: boolean;
  notificado_sin_rival: boolean;
  rival_confirmacion_estado: 'esperando' | 'confirmado' | 'rechazado' | null;
}

export interface Reserva {
  id: number;
  created_at: string;
  solicitud_1_id: number | null;
  solicitud_2_id: number | null;
  capitan_1: string;
  capitan_2: string;
  telefono_1: string;
  telefono_2: string;
  deporte: DeporteTipo;
  cancha: string;
  fecha: string;          // YYYY-MM-DD
  hora_inicio: string;    // HH:MM
  hora_fin: string;       // HH:MM
  estado_pago: EstadoPago;
  comprobante_url: string | null;
  estado_reserva: EstadoReserva;
  google_calendar_event_id: string | null;
  recordatorio_enviado: boolean;
  recordatorio_enviado_at: string | null;
  valor_total: number | null;
  notas: string | null;
}

export interface Match {
  solicitud_1: string;
  solicitud_2: string;
  deporte: DeporteTipo | null;
  nivel: string | null;
  fecha: string | null;
  estado: EstadoMatch;
}

// ── Conversaciones AI ─────────────────────────────────────────────────────────

export interface MensajeIA {
  role: 'user' | 'assistant';
  content: string | ContentBlock[];
}

export interface ContentBlock {
  type: 'text' | 'tool_use' | 'tool_result';
  text?: string;
  id?: string;
  name?: string;
  input?: Record<string, unknown>;
  tool_use_id?: string;
  content?: string;
}

export interface Conversacion {
  id: string;
  telefono: string;
  mensajes: MensajeIA[];
  created_at: string;
  updated_at: string;
}

// ── Disponibilidad ────────────────────────────────────────────────────────────

export interface SlotDisponible {
  inicio: string;   // HH:MM
  fin: string;      // HH:MM
  disponible: boolean;
}

// ── Candidato matchmaking ─────────────────────────────────────────────────────

export interface CandidatoMatchmaking {
  nombre: string;
  telefono: string;
  fuente: 'capitanes' | 'clientes' | 'solicitudes';
  sport_type: DeporteTipo;
  nivel_futbol?: NivelFutbol;
  nivel_padel?: NivelPadel;
  franja_horaria: string[];
  compatible: boolean;
  razon?: string;
}

// ── API ───────────────────────────────────────────────────────────────────────

export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}
