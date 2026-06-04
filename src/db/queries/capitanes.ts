import { db } from '../client.js';
import type { Capitan, DeporteTipo, NivelFutbol, NivelPadel } from '../../types/index.js';

export async function buscarCapitanesCompatibles(opts: {
  deporte: DeporteTipo;
  nivel_futbol?: NivelFutbol;
  nivel_padel?: NivelPadel;
  franja?: string;
  excluir_telefono?: string;
}): Promise<Capitan[]> {
  let query = db.client
    .from('Capitanes')
    .select('*')
    .or(`sport_type.eq.${opts.deporte},sport_type.eq.ambos`);

  if (opts.excluir_telefono) {
    query = query.neq('telefono', opts.excluir_telefono);
  }

  const { data, error } = await query.limit(50);
  if (error) throw new Error(`Error buscando capitanes: ${error.message}`);

  let resultados = (data ?? []) as Capitan[];

  if (opts.franja) {
    resultados = resultados.filter(c => c.franja_horaria?.includes(opts.franja!));
  }

  return resultados;
}

export async function obtenerCapitanPorTelefono(telefono: string): Promise<Capitan | null> {
  const { data } = await db.client
    .from('Capitanes')
    .select('*')
    .eq('telefono', telefono)
    .maybeSingle();
  return (data as Capitan) ?? null;
}

export async function insertarCapitan(payload: {
  nombre_capitan: string;
  telefono: string;
  sport_type: DeporteTipo;
  franja_horaria: string[];
  nivel_futbol: NivelFutbol;
  nivel_padel: NivelPadel;
}): Promise<Capitan> {
  const { data, error } = await db.client
    .from('Capitanes')
    .insert(payload)
    .select()
    .single();
  if (error) throw new Error(`Error registrando capitán: ${error.message}`);
  return data as Capitan;
}

// Devuelve en qué fuente está registrado el teléfono: 'capitanes', 'clientes', o null
export async function verificarRegistroTelefono(
  telefono: string
): Promise<'capitanes' | 'clientes' | null> {
  const enCapitanes = await db.client
    .from('Capitanes')
    .select('id')
    .eq('telefono', telefono)
    .maybeSingle();

  if (enCapitanes.data) return 'capitanes';

  const enClientes = await db.client
    .from('Clientes')
    .select('id')
    .eq('telefono', telefono)
    .maybeSingle();

  if (enClientes.data) return 'clientes';

  return null;
}
