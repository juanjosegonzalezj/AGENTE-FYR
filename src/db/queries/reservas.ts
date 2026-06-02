import { db } from '../client.js';
import type { Reserva, EstadoReserva, EstadoPago, DeporteTipo } from '../../types/index.js';

export async function crearReserva(payload: {
  solicitud_1_id?: number;
  solicitud_2_id?: number;
  capitan_1: string;
  capitan_2: string;
  telefono_1: string;
  telefono_2: string;
  deporte: DeporteTipo;
  cancha: string;
  fecha: string;
  hora_inicio: string;
  hora_fin: string;
  valor_total?: number;
  google_calendar_event_id?: string;
  notas?: string;
}): Promise<Reserva> {
  const { data, error } = await db.client
    .from('Reservas')
    .insert({
      ...payload,
      estado_pago: 'pendiente_pago',
      estado_reserva: 'pendiente',
      recordatorio_enviado: false,
    })
    .select()
    .single();

  if (error) throw new Error(`Error creando reserva: ${error.message}`);
  return data as Reserva;
}

export async function obtenerReservaPorId(id: number): Promise<Reserva | null> {
  const { data } = await db.client
    .from('Reservas')
    .select('*')
    .eq('id', id)
    .maybeSingle();
  return (data as Reserva) ?? null;
}

export async function obtenerReservaPorTelefono(telefono: string): Promise<Reserva | null> {
  const { data } = await db.client
    .from('Reservas')
    .select('*')
    .or(`telefono_1.eq.${telefono},telefono_2.eq.${telefono}`)
    .not('estado_reserva', 'in', '("cancelada","completada")')
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  return (data as Reserva) ?? null;
}

export async function confirmarPago(
  id: number,
  comprobante_url?: string
): Promise<Reserva> {
  const { data, error } = await db.client
    .from('Reservas')
    .update({
      estado_pago: 'confirmado',
      estado_reserva: 'reservada',
      comprobante_url: comprobante_url ?? null,
    })
    .eq('id', id)
    .select()
    .single();

  if (error) throw new Error(`Error confirmando pago: ${error.message}`);
  return data as Reserva;
}

export async function actualizarReserva(
  id: number,
  payload: Partial<Reserva>
): Promise<Reserva> {
  const { data, error } = await db.client
    .from('Reservas')
    .update(payload)
    .eq('id', id)
    .select()
    .single();

  if (error) throw new Error(`Error actualizando reserva: ${error.message}`);
  return data as Reserva;
}

export async function cancelarReserva(id: number): Promise<void> {
  await db.client
    .from('Reservas')
    .update({ estado_reserva: 'cancelada' })
    .eq('id', id);
}

// Para el job de recordatorios: reservas confirmadas en los próximos 45 min
export async function obtenerReservasParaRecordatorio(): Promise<Reserva[]> {
  const ahora = new Date();
  const hoy = ahora.toISOString().split('T')[0];

  const horaAhora = ahora.toTimeString().slice(0, 5);
  const en45min = new Date(ahora.getTime() + 45 * 60 * 1000);
  const en45minStr = en45min.toTimeString().slice(0, 5);
  // Solo si el partido es hoy o mañana y dentro de 45 minutos
  const manana = new Date(ahora);
  manana.setDate(manana.getDate() + 1);
  const mananaStr = manana.toISOString().split('T')[0];

  const { data } = await db.client
    .from('Reservas')
    .select('*')
    .eq('estado_reserva', 'reservada')
    .eq('estado_pago', 'confirmado')
    .eq('recordatorio_enviado', false)
    .in('fecha', [hoy, mananaStr])
    .gte('hora_inicio', horaAhora)
    .lte('hora_inicio', en45minStr);

  return (data ?? []) as Reserva[];
}

export async function marcarRecordatorioEnviado(id: number): Promise<void> {
  await db.client
    .from('Reservas')
    .update({
      recordatorio_enviado: true,
      recordatorio_enviado_at: new Date().toISOString(),
    })
    .eq('id', id);
}
