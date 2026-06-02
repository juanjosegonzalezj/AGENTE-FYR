import type { NivelFutbol, NivelPadel, DeporteTipo, CandidatoMatchmaking, Capitan, Solicitud } from '../../types/index.js';
import { buscarCapitanesCompatibles } from '../../db/queries/capitanes.js';
import { buscarClientesCompatibles } from '../../db/queries/clientes.js';
import { buscarSolicitudesPendientesCompatibles } from '../../db/queries/solicitudes.js';
import logger from '../../utils/logger.js';

// ── Reglas de compatibilidad ──────────────────────────────────────────────────

const NIVELES_FUTBOL: NivelFutbol[] = ['Bajo', 'Intermedio', 'Alto'];

function futbolCompatible(a: NivelFutbol, b: NivelFutbol): boolean {
  const ia = NIVELES_FUTBOL.indexOf(a);
  const ib = NIVELES_FUTBOL.indexOf(b);
  return Math.abs(ia - ib) <= 1; // Máximo 1 nivel de diferencia
}

const NIVELES_PADEL: NivelPadel[] = ['1ra', '2da', '3ra', '4ta', '5ta'];

function padelCompatible(a: NivelPadel, b: NivelPadel): boolean {
  const ia = NIVELES_PADEL.indexOf(a);
  const ib = NIVELES_PADEL.indexOf(b);
  return Math.abs(ia - ib) <= 1; // Máximo 1 categoría de diferencia
}

function franjaCompatible(
  franjasRival: string[],
  franjaDeseada?: string
): boolean {
  if (!franjaDeseada) return true;
  return franjasRival?.includes(franjaDeseada) ?? false;
}

// ── Conversor de Capitan/Cliente a CandidatoMatchmaking ───────────────────────

function capitanToCandidato(
  c: Capitan,
  fuente: 'capitanes' | 'clientes',
  deporte: DeporteTipo,
  nivel_futbol?: NivelFutbol,
  nivel_padel?: NivelPadel,
  franja?: string
): CandidatoMatchmaking | null {
  let compatible = false;
  let razon = '';

  if (deporte === 'fútbol') {
    if (!nivel_futbol) return null;
    compatible = futbolCompatible(c.nivel_futbol, nivel_futbol);
    razon = compatible
      ? `Nivel fútbol compatible: ${c.nivel_futbol}`
      : `Nivel incompatible: ${c.nivel_futbol} vs ${nivel_futbol}`;
  } else if (deporte === 'pádel') {
    if (!nivel_padel) return null;
    compatible = padelCompatible(c.nivel_padel, nivel_padel);
    razon = compatible
      ? `Categoría pádel compatible: ${c.nivel_padel}`
      : `Categoría incompatible: ${c.nivel_padel} vs ${nivel_padel}`;
  }

  if (!compatible) return null;
  if (franja && !franjaCompatible(c.franja_horaria, franja)) return null;

  return {
    nombre: c.nombre_capitan,
    telefono: c.telefono ?? '',
    fuente,
    sport_type: c.sport_type,
    nivel_futbol: c.nivel_futbol,
    nivel_padel: c.nivel_padel,
    franja_horaria: c.franja_horaria ?? [],
    compatible: true,
    razon,
  };
}

function solicitudToCandidato(
  s: Solicitud,
  deporte: DeporteTipo,
  nivel_futbol?: NivelFutbol,
  nivel_padel?: NivelPadel,
  franja?: string
): CandidatoMatchmaking | null {
  let compatible = false;

  if (deporte === 'fútbol' && nivel_futbol) {
    compatible = futbolCompatible(s.nivel as NivelFutbol, nivel_futbol);
  } else if (deporte === 'pádel' && nivel_padel) {
    compatible = padelCompatible(s.nivel as NivelPadel, nivel_padel);
  }

  if (!compatible) return null;
  if (franja && s.horario_deseado && s.horario_deseado !== franja) return null;

  return {
    nombre: s.nombre,
    telefono: s.telefono,
    fuente: 'solicitudes',
    sport_type: deporte,
    nivel_futbol: deporte === 'fútbol' ? s.nivel as NivelFutbol : undefined,
    nivel_padel:  deporte === 'pádel'  ? s.nivel as NivelPadel  : undefined,
    franja_horaria: s.horario_deseado ? [s.horario_deseado] : [],
    compatible: true,
    razon: `Solicitud pendiente – nivel ${s.nivel}`,
  };
}

// ── Función principal ─────────────────────────────────────────────────────────

export async function buscarRival(opts: {
  deporte: DeporteTipo;
  nivel_futbol?: NivelFutbol;
  nivel_padel?: NivelPadel;
  franja?: string;
  telefono_solicitante: string;
}): Promise<{
  encontrado: boolean;
  candidatos: CandidatoMatchmaking[];
  mensaje: string;
}> {
  const { deporte, nivel_futbol, nivel_padel, franja, telefono_solicitante } = opts;

  logger.info('Buscando rival', { deporte, nivel_futbol, nivel_padel, franja });

  // Prioridad 1: Capitanes FYR
  const capitanes = await buscarCapitanesCompatibles({
    deporte,
    nivel_futbol,
    nivel_padel,
    franja,
    excluir_telefono: telefono_solicitante,
  });

  const candidatosCapitanes: CandidatoMatchmaking[] = capitanes
    .map(c => capitanToCandidato(c, 'capitanes', deporte, nivel_futbol, nivel_padel, franja))
    .filter((c): c is CandidatoMatchmaking => c !== null);

  if (candidatosCapitanes.length > 0) {
    logger.info(`Rival encontrado en Capitanes: ${candidatosCapitanes[0].nombre}`);
    return {
      encontrado: true,
      candidatos: candidatosCapitanes.slice(0, 3),
      mensaje: `Encontré ${candidatosCapitanes.length} rival(es) en la base de capitanes FYR.`,
    };
  }

  // Prioridad 2: Clientes del complejo
  const clientes = await buscarClientesCompatibles({
    deporte,
    nivel_futbol,
    nivel_padel,
    franja,
    excluir_telefono: telefono_solicitante,
  });

  const candidatosClientes: CandidatoMatchmaking[] = clientes
    .map(c => capitanToCandidato(c, 'clientes', deporte, nivel_futbol, nivel_padel, franja))
    .filter((c): c is CandidatoMatchmaking => c !== null);

  if (candidatosClientes.length > 0) {
    logger.info(`Rival encontrado en Clientes: ${candidatosClientes[0].nombre}`);
    return {
      encontrado: true,
      candidatos: candidatosClientes.slice(0, 3),
      mensaje: `Encontré ${candidatosClientes.length} rival(es) en la base de clientes del complejo.`,
    };
  }

  // Prioridad 3: Solicitudes pendientes recientes
  const solicitudes = await buscarSolicitudesPendientesCompatibles({
    deporte,
    nivel: deporte === 'fútbol' ? (nivel_futbol ?? '') : (nivel_padel ?? ''),
    franja,
    excluir_telefono: telefono_solicitante,
  });

  const candidatosSolicitudes: CandidatoMatchmaking[] = solicitudes
    .map(s => solicitudToCandidato(s, deporte, nivel_futbol, nivel_padel, franja))
    .filter((c): c is CandidatoMatchmaking => c !== null);

  if (candidatosSolicitudes.length > 0) {
    logger.info(`Rival encontrado en Solicitudes: ${candidatosSolicitudes[0].nombre}`);
    return {
      encontrado: true,
      candidatos: candidatosSolicitudes.slice(0, 3),
      mensaje: `Encontré ${candidatosSolicitudes.length} solicitud(es) pendiente(s) compatible(s).`,
    };
  }

  logger.info('No se encontró rival compatible');
  return {
    encontrado: false,
    candidatos: [],
    mensaje: 'No encontré rival disponible en este momento. Tu solicitud quedará en espera y te avisaré cuando aparezca alguien compatible.',
  };
}
