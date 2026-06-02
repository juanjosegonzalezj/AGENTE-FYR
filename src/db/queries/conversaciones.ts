import { db } from '../client.js';
import type { Conversacion, MensajeIA } from '../../types/index.js';

export async function obtenerOCrearConversacion(telefono: string): Promise<Conversacion> {
  const { data: existing } = await db.client
    .from('Conversaciones')
    .select('*')
    .eq('telefono', telefono)
    .maybeSingle();

  if (existing) return existing as Conversacion;

  const { data, error } = await db.client
    .from('Conversaciones')
    .insert({ telefono, mensajes: [] })
    .select()
    .single();

  if (error) throw new Error(`Error creando conversación: ${error.message}`);
  return data as Conversacion;
}

export async function agregarMensajes(
  telefono: string,
  nuevos: MensajeIA[]
): Promise<void> {
  const conv = await obtenerOCrearConversacion(telefono);
  const mensajes = [...(conv.mensajes ?? []), ...nuevos];

  // Conservar solo los últimos 30 mensajes para no saturar contexto
  const recientes = mensajes.slice(-30);

  await db.client
    .from('Conversaciones')
    .update({
      mensajes: recientes,
      updated_at: new Date().toISOString(),
    })
    .eq('telefono', telefono);
}

export async function resetearConversacion(telefono: string): Promise<void> {
  await db.client
    .from('Conversaciones')
    .update({ mensajes: [], updated_at: new Date().toISOString() })
    .eq('telefono', telefono);
}
