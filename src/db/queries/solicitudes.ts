import { db } from '../client.js';
import type { Solicitud, EstadoSolicitud, DeporteTipo } from '../../types/index.js';

export async function crearSolicitud(payload: {
  nombre: string;
  telefono: string;
  deporte: DeporteTipo;
  nivel: string;
  horario_deseado?: string;
  observaciones?: string;
}): Promise<Solicitud> {
  const { data, error } = await db.client
    .from('Solicitudes')
    .insert({
      ...payload,
      estado: 'pendiente',
      rival_encontrado: false,
      busqueda_activa: true,
      notificado_sin_rival: false,
    })
    .select()
    .single();

  if (error) throw new Error(`Error creando solicitud: ${error.message}`);
  return data as Solicitud;
}

export async function actualizarSolicitud(
  id: number,
  payload: Partial<Solicitud>
): Promise<Solicitud> {
  const { data, error } = await db.client
    .from('Solicitudes')
    .update(payload)
    .eq('id', id)
    .select()
    .single();

  if (error) throw new Error(`Error actualizando solicitud: ${error.message}`);
  return data as Solicitud;
}

export async function obtenerSolicitudPorId(id: number): Promise<Solicitud | null> {
  const { data } = await db.client
    .from('Solicitudes')
    .select('*')
    .eq('id', id)
    .maybeSingle();
  return (data as Solicitud) ?? null;
}

export async function obtenerSolicitudPorTelefono(telefono: string): Promise<Solicitud | null> {
  const { data } = await db.client
    .from('Solicitudes')
    .select('*')
    .eq('telefono', telefono)
    .not('estado', 'in', '("completado","cancelado")')
    .order('fecha_solicitud', { ascending: false })
    .limit(1)
    .maybeSingle();
  return (data as Solicitud) ?? null;
}

// Solicitudes pendientes de búsqueda (para el job automático)
export async function obtenerSolicitudesPendientesBusqueda(): Promise<Solicitud[]> {
  const { data, error } = await db.client
    .from('Solicitudes')
    .select('*')
    .eq('busqueda_activa', true)
    .eq('rival_encontrado', false)
    .in('estado', ['pendiente', 'buscando_rival'])
    .order('fecha_solicitud', { ascending: true });

  if (error) throw new Error(`Error obteniendo solicitudes pendientes: ${error.message}`);
  return (data ?? []) as Solicitud[];
}

// Solicitudes sin rival después de 2 horas (para notificar al usuario)
export async function obtenerSolicitudesVencidas(): Promise<Solicitud[]> {
  const hace2horas = new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString();

  const { data } = await db.client
    .from('Solicitudes')
    .select('*')
    .eq('rival_encontrado', false)
    .eq('notificado_sin_rival', false)
    .eq('busqueda_activa', true)
    .lt('fecha_solicitud', hace2horas);

  return (data ?? []) as Solicitud[];
}

// Busca una solicitud donde este teléfono ES el rival y está esperando confirmar
export async function buscarSolicitudEsperandoConfirmacion(
  rivalTelefono: string
): Promise<Solicitud | null> {
  const { data } = await db.client
    .from('Solicitudes')
    .select('*')
    .eq('rival_telefono', rivalTelefono)
    .eq('rival_confirmacion_estado', 'esperando')
    .order('fecha_solicitud', { ascending: false })
    .limit(1)
    .maybeSingle();
  return (data as Solicitud) ?? null;
}

export async function buscarSolicitudesPendientesCompatibles(opts: {
  deporte: DeporteTipo;
  nivel: string;
  franja?: string;
  excluir_telefono?: string;
}): Promise<Solicitud[]> {
  const hace2horas = new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString();

  let query = db.client
    .from('Solicitudes')
    .select('*')
    .eq('deporte', opts.deporte)
    .eq('rival_encontrado', false)
    .in('estado', ['pendiente', 'buscando_rival'])
    .gte('fecha_solicitud', hace2horas); // Prioridad: últimas 2h

  if (opts.excluir_telefono) {
    query = query.neq('telefono', opts.excluir_telefono);
  }

  const { data } = await query.limit(20);
  return (data ?? []) as Solicitud[];
}
