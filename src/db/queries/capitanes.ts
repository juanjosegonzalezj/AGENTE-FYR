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

  // Filtrar por franja horaria si se especifica
  if (opts.franja) {
    resultados = resultados.filter(c =>
      c.franja_horaria?.includes(opts.franja!)
    );
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
