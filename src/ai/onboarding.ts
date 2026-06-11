import type { MensajeIA } from '../types/index.js';

// ── Mensajes exactos del flujo ────────────────────────────────────────────────

export const MSG_DEPORTE =
  `¿Qué deporte deseas jugar?\n\n` +
  `1. Fútbol\n` +
  `2. Pádel\n\n` +
  `Por favor responde únicamente con el número correspondiente.`;

export const MSG_NIVEL_FUTBOL =
  `¿Cuál es tu nivel?\n\n` +
  `1. Alto\n` +
  `2. Medio\n` +
  `3. Bajo\n\n` +
  `Por favor responde únicamente con el número de tu nivel.`;

export const MSG_CATEGORIA_PADEL =
  `¿Cuál es tu categoría?\n\n` +
  `1. Primera\n` +
  `2. Segunda\n` +
  `3. Tercera\n` +
  `4. Cuarta\n` +
  `5. Quinta\n\n` +
  `Por favor responde únicamente con el número de tu categoría.`;

export const MSG_FRANJA =
  `¿Qué franja horaria prefieres?\n\n` +
  `1. 6am – 9am\n` +
  `2. 9am – 12pm\n` +
  `3. 12pm – 3pm\n` +
  `4. 3pm – 6pm\n` +
  `5. 6pm – 9pm\n` +
  `6. 9pm – 11pm\n\n` +
  `Por favor responde únicamente con el número de la opción.`;

export const MSG_CONFIRMACION =
  `Perfecto. Ya tenemos tu información. Estamos buscando un rival compatible para ti. ` +
  `Te contactaré cuando encontremos un jugador que coincida con tu nivel y disponibilidad.`;

// ── Mapas ─────────────────────────────────────────────────────────────────────

// Deporte
const MAPA_DEPORTE: Record<string, string> = { '1': 'fútbol', '2': 'pádel' };

// Nivel fútbol: se muestra "Medio" pero se guarda "Intermedio" para la DB
const MAPA_NIVEL: Record<string, string> = {
  '1': 'Alto',
  '2': 'Intermedio', // "Medio" en pantalla → "Intermedio" en DB
  '3': 'Bajo',
};

// Categoría pádel
const MAPA_CATEGORIA: Record<string, string> = {
  '1': '1ra', '2': '2da', '3': '3ra', '4': '4ta', '5': '5ta',
};

// Franja horaria
const MAPA_FRANJA: Record<string, string> = {
  '1': '6am-9am',  '2': '9am-12pm', '3': '12pm-3pm',
  '4': '3pm-6pm',  '5': '6pm-9pm',  '6': '9pm-11pm',
};

// ── Tipos ─────────────────────────────────────────────────────────────────────

export interface DatosOnboarding {
  nombre?:   string;
  telefono?: string;
  deporte?:  'fútbol' | 'pádel';
  nivel?:    string;
  franjas?:  string[];
}

type ResultadoOnboarding =
  | { completo: false; respuesta: string }
  | { completo: true;  datos: DatosOnboarding };

// ── Helpers ───────────────────────────────────────────────────────────────────

function ultimaRespuestaAsistente(msgs: MensajeIA[]): string {
  for (let i = msgs.length - 1; i >= 0; i--) {
    const m = msgs[i];
    if (m.role === 'assistant' && typeof m.content === 'string') return m.content;
  }
  return '';
}

function ultimaRespuestaUsuario(msgs: MensajeIA[]): string {
  for (let i = msgs.length - 1; i >= 0; i--) {
    const m = msgs[i];
    if (m.role === 'user' && typeof m.content === 'string') return m.content.trim();
  }
  return '';
}

function extraerDatos(msgs: MensajeIA[]): DatosOnboarding {
  const datos: DatosOnboarding = {};
  for (let i = 0; i < msgs.length - 1; i++) {
    const a = msgs[i];
    const b = msgs[i + 1];
    if (a.role !== 'assistant' || b.role !== 'user') continue;
    const pregunta  = typeof a.content === 'string' ? a.content : '';
    const respuesta = typeof b.content === 'string' ? b.content.trim() : '';

    // Nombre — viene después del saludo inicial
    if (pregunta.includes('nombre completo') && respuesta && !datos.nombre) {
      datos.nombre = respuesta;
    }

    // Teléfono — viene después de "Gracias, ... ¿Cuál es tu número"
    if (pregunta.includes('número de teléfono') && respuesta && !datos.telefono) {
      const digitos = respuesta.replace(/\D/g, '');
      if (digitos.length >= 7) datos.telefono = digitos;
    }

    // Deporte
    if (pregunta.includes('Fútbol') && pregunta.includes('Pádel') && !datos.deporte) {
      const d = MAPA_DEPORTE[respuesta];
      if (d) datos.deporte = d as 'fútbol' | 'pádel';
    }

    // Nivel / categoría
    if ((pregunta.includes('nivel?') || pregunta.includes('categoría?')) && !datos.nivel) {
      const n = MAPA_NIVEL[respuesta] ?? MAPA_CATEGORIA[respuesta];
      if (n) datos.nivel = n;
    }

    // Franja
    if (pregunta.includes('franja horaria') && !datos.franjas) {
      const nums = respuesta.split(/[\s,]+/);
      const fs   = nums.map(n => MAPA_FRANJA[n]).filter(Boolean);
      if (fs.length > 0) datos.franjas = fs;
    }
  }
  return datos;
}

// ── Máquina de estados ────────────────────────────────────────────────────────

export function procesarOnboarding(msgs: MensajeIA[]): ResultadoOnboarding {
  const datos    = extraerDatos(msgs);
  const ultimaIA = ultimaRespuestaAsistente(msgs);
  const respUser = ultimaRespuestaUsuario(msgs);

  // Paso 1 — nombre
  if (!datos.nombre) {
    if (ultimaIA.includes('nombre completo') && respUser) {
      datos.nombre = respUser;
    } else {
      return { completo: false, respuesta: `¿Cuál es tu nombre completo?` };
    }
  }

  // Paso 2 — teléfono
  if (!datos.telefono) {
    if (ultimaIA.includes('número de teléfono') && respUser) {
      const digitos = respUser.replace(/\D/g, '');
      if (digitos.length >= 7) {
        datos.telefono = digitos;
      } else {
        return { completo: false, respuesta: `Ese número no parece válido. ¿Cuál es tu número de teléfono?` };
      }
    } else {
      return { completo: false, respuesta: `Gracias, ${datos.nombre}. ¿Cuál es tu número de teléfono?` };
    }
  }

  // Paso 3 — deporte
  if (!datos.deporte) {
    if (ultimaIA.includes('Fútbol') && ultimaIA.includes('Pádel')) {
      const d = MAPA_DEPORTE[respUser];
      if (d) {
        datos.deporte = d as 'fútbol' | 'pádel';
      } else {
        return { completo: false, respuesta: `Opción no válida. Por favor responde *1* para Fútbol o *2* para Pádel.\n\n${MSG_DEPORTE}` };
      }
    } else {
      return { completo: false, respuesta: MSG_DEPORTE };
    }
  }

  // Paso 4 — nivel / categoría
  if (!datos.nivel) {
    const esFutbol  = datos.deporte === 'fútbol';
    const mapa      = esFutbol ? MAPA_NIVEL : MAPA_CATEGORIA;
    const menu      = esFutbol ? MSG_NIVEL_FUTBOL : MSG_CATEGORIA_PADEL;
    const maxOpc    = esFutbol ? 3 : 5;
    const esperando = (esFutbol && ultimaIA.includes('nivel?')) ||
                      (!esFutbol && ultimaIA.includes('categoría?'));

    if (esperando) {
      const n = mapa[respUser];
      if (n) {
        datos.nivel = n;
      } else {
        return { completo: false, respuesta: `Opción no válida. Por favor responde un número del *1* al *${maxOpc}*.\n\n${menu}` };
      }
    } else {
      return { completo: false, respuesta: menu };
    }
  }

  // Paso 5 — franja
  if (!datos.franjas) {
    if (ultimaIA.includes('franja horaria')) {
      const nums = respUser.split(/[\s,]+/);
      const fs   = nums.map(n => MAPA_FRANJA[n]).filter(Boolean);
      if (fs.length > 0) {
        datos.franjas = fs;
      } else {
        return { completo: false, respuesta: `Opción no válida. Por favor responde con números del *1* al *6*.\n\n${MSG_FRANJA}` };
      }
    } else {
      return { completo: false, respuesta: MSG_FRANJA };
    }
  }

  return { completo: true, datos };
}

export function onboardingTerminado(msgs: MensajeIA[]): boolean {
  if (msgs.length > 14) return true;
  return msgs.some(m =>
    m.role === 'assistant' &&
    typeof m.content === 'string' &&
    (m.content.includes('Estamos buscando') || m.content.includes('rival compatible') || m.content.includes('Buenas noticias'))
  );
}
