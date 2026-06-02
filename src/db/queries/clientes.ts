import { db } from '../client.js';
import type { Cliente, DeporteTipo, NivelFutbol, NivelPadel } from '../../types/index.js';

export async function buscarClientesCompatibles(opts: {
  deporte: DeporteTipo;
  nivel_futbol?: NivelFutbol;
  nivel_padel?: NivelPadel;
  franja?: string;
  excluir_telefono?: string;
}): Promise<Cliente[]> {
  let query = db.client
    .from('Clientes')
    .select('*')
    .or(`sport_type.eq.${opts.deporte},sport_type.eq.ambos`);

  if (opts.excluir_telefono) {
    query = query.neq('telefono', opts.excluir_telefono);
  }

  const { data, error } = await query.limit(50);
  if (error) throw new Error(`Error buscando clientes: ${error.message}`);

  let resultados = (data ?? []) as Cliente[];

  if (opts.franja) {
    resultados = resultados.filter(c =>
      c.franja_horaria?.includes(opts.franja!)
    );
  }

  return resultados;
}
