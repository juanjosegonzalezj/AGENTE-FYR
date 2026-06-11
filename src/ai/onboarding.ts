import type { MensajeIA } from '../types/index.js';

// ── Mensajes exactos de cada paso ─────────────────────────────────────────────

export const PREGUNTAS = {
  nombre:   `¿Cuál es tu nombre completo?`,
  telefono: `¿Cuál es tu número de celular?`,
  deporte: `¿Qué deporte quieres jugar?\n\n1. Fútbol\n2. Pádel`,
  nivel_futbol: `¿Cuál es tu nivel en fútbol?\n\n1. Bajo\n2. Intermedio\n3. Alto`,
  categoria_padel: `¿Cuál es tu categoría en pádel?\n\n1. Primera (1ra)\n2. Segunda (2da)\n3. Tercera (3ra)\n4. Cuarta (4ta)\n5. Quinta (5ta)`,
  franja: `¿En qué franja horaria prefieres jugar?\n\n1. 6am – 9am\n2. 9am – 12pm\n3. 12pm – 3pm\n4. 3pm – 6pm\n5. 6pm – 9pm\n6. 9pm – 11pm\n\nPuedes elegir más de una (ej: 2 5).`,
};

const INVALIDO_DEPORTE     = `Opción no válida. Por favor responde *1* para Fútbol o *2* para Pádel.`;
const INVALIDO_NIVEL       = `Opción no válida. Por favor responde *1*, *2* o *3*.`;
const INVALIDO_CATEGORIA   = `Opción no válida. Por favor responde un número del *1* al *5*.`;
const INVALIDO_FRANJA      = `Opción no válida. Por favor responde con números del *1* al *6* (ej: 1 4 5).`;

// ── Mapas ─────────────────────────────────────────────────────────────────────

const MAPA_DEPORTE:   Record<string, string> = { '1':'fútbol',     '2':'pádel'     };
const MAPA_NIVEL:     Record<string, string> = { '1':'Bajo',       '2':'Intermedio','3':'Alto' };
const MAPA_CATEGORIA: Record<string, string> = { '1':'1ra','2':'2da','3':'3ra','4':'4ta','5':'5ta' };
const MAPA_FRANJA:    Record<string, string> = {
  '1':'6am-9am','2':'9am-12pm','3':'12pm-3pm',
  '4':'3pm-6pm','5':'6pm-9pm', '6':'9pm-11pm',
};

// ── Tipos ─────────────────────────────────────────────────────────────────────

export interface DatosOnboarding {
  nombre?:    string;
  telefono?:  string;
  deporte?:   'fútbol' | 'pádel';
  nivel?:     string;    // nivel fútbol o categoría pádel
  franjas?:   string[];
}

type ResultadoOnboarding =
  | { completo: false; respuesta: string }   // devuelve la próxima pregunta o error
  | { completo: true;  datos: DatosOnboarding };

// ── Detectar en qué paso estamos leyendo el historial ─────────────────────────

function ultimaRespuestaAsistente(mensajes: MensajeIA[]): string {
  for (let i = mensajes.length - 1; i >= 0; i--) {
    const m = mensajes[i];
    if (m.role === 'assistant' && typeof m.content === 'string') return m.content;
  }
  return '';
}

function textoUsuario(mensajes: MensajeIA[]): string {
  for (let i = mensajes.length - 1; i >= 0; i--) {
    const m = mensajes[i];
    if (m.role === 'user' && typeof m.content === 'string') return m.content.trim();
  }
  return '';
}

function extraerDatosHastaNow(mensajes: MensajeIA[]): DatosOnboarding {
  const datos: DatosOnboarding = {};
  // Recorremos pares pregunta-respuesta para extraer datos ya confirmados
  for (let i = 0; i < mensajes.length - 1; i++) {
    const a = mensajes[i];
    const b = mensajes[i + 1];
    if (a.role !== 'assistant' || b.role !== 'user') continue;
    const pregunta  = typeof a.content === 'string' ? a.content : '';
    const respuesta = typeof b.content === 'string' ? b.content.trim() : '';

    if (pregunta.includes('nombre completo') && respuesta) {
      datos.nombre = respuesta;
    }
    if (pregunta.includes('número de celular') && respuesta) {
      datos.telefono = respuesta.replace(/\D/g, '');
      if (datos.telefono.length >= 7) datos.telefono = datos.telefono; else delete datos.telefono;
    }
    if (pregunta.includes('Fútbol') && pregunta.includes('Pádel')) {
      const d = MAPA_DEPORTE[respuesta];
      if (d) datos.deporte = d as 'fútbol' | 'pádel';
    }
    if (pregunta.includes('nivel en fútbol') || pregunta.includes('categoría en pádel')) {
      const n = MAPA_NIVEL[respuesta] ?? MAPA_CATEGORIA[respuesta];
      if (n) datos.nivel = n;
    }
    if (pregunta.includes('franja horaria')) {
      const nums = respuesta.split(/\s+/);
      const fs = nums.map(n => MAPA_FRANJA[n]).filter(Boolean);
      if (fs.length > 0) datos.franjas = fs;
    }
  }
  return datos;
}

// ── Función principal ─────────────────────────────────────────────────────────

export function procesarOnboarding(
  mensajes: MensajeIA[],  // historial INCLUYENDO el nuevo mensaje del usuario
): ResultadoOnboarding {

  const datos    = extraerDatosHastaNow(mensajes);
  const ultimaIA = ultimaRespuestaAsistente(mensajes);
  const respUser = textoUsuario(mensajes);

  // ── Paso 1: necesitamos nombre ────────────────────────────────────────────
  if (!datos.nombre) {
    // La última pregunta del asistente es la del nombre → la respuesta ES el nombre
    if (ultimaIA.includes('nombre completo') && respUser) {
      datos.nombre = respUser;
    } else {
      return { completo: false, respuesta: PREGUNTAS.nombre };
    }
  }

  // ── Paso 2: necesitamos teléfono ──────────────────────────────────────────
  if (!datos.telefono) {
    if (ultimaIA.includes('número de celular') && respUser) {
      const digitos = respUser.replace(/\D/g, '');
      if (digitos.length >= 7) {
        datos.telefono = digitos;
      } else {
        return { completo: false, respuesta: `Ese número no parece válido. ¿Cuál es tu número de celular?` };
      }
    } else {
      return { completo: false, respuesta: PREGUNTAS.telefono };
    }
  }

  // ── Paso 3: necesitamos deporte ───────────────────────────────────────────
  if (!datos.deporte) {
    if (ultimaIA.includes('Fútbol') && ultimaIA.includes('Pádel')) {
      const d = MAPA_DEPORTE[respUser];
      if (d) {
        datos.deporte = d as 'fútbol' | 'pádel';
      } else {
        return { completo: false, respuesta: `${INVALIDO_DEPORTE}\n\n${PREGUNTAS.deporte}` };
      }
    } else {
      return { completo: false, respuesta: PREGUNTAS.deporte };
    }
  }

  // ── Paso 4: necesitamos nivel / categoría ─────────────────────────────────
  if (!datos.nivel) {
    const esFutbol = datos.deporte === 'fútbol';
    const mapa     = esFutbol ? MAPA_NIVEL : MAPA_CATEGORIA;
    const menuKey  = esFutbol ? 'nivel_futbol' : 'categoria_padel';
    const invalido = esFutbol ? INVALIDO_NIVEL : INVALIDO_CATEGORIA;

    const esperandoRespuesta =
      (esFutbol && ultimaIA.includes('nivel en fútbol')) ||
      (!esFutbol && ultimaIA.includes('categoría en pádel'));

    if (esperandoRespuesta) {
      const n = mapa[respUser];
      if (n) {
        datos.nivel = n;
      } else {
        return { completo: false, respuesta: `${invalido}\n\n${PREGUNTAS[menuKey]}` };
      }
    } else {
      return { completo: false, respuesta: PREGUNTAS[menuKey] };
    }
  }

  // ── Paso 5: necesitamos franja ────────────────────────────────────────────
  if (!datos.franjas) {
    if (ultimaIA.includes('franja horaria')) {
      const nums = respUser.split(/\s+/);
      const fs   = nums.map(n => MAPA_FRANJA[n]).filter(Boolean);
      if (fs.length > 0) {
        datos.franjas = fs;
      } else {
        return { completo: false, respuesta: `${INVALIDO_FRANJA}\n\n${PREGUNTAS.franja}` };
      }
    } else {
      return { completo: false, respuesta: PREGUNTAS.franja };
    }
  }

  // ── Onboarding completo ───────────────────────────────────────────────────
  return { completo: true, datos };
}

// Devuelve true si el historial ya superó el onboarding (hay mensajes de Claude sobre partido)
export function onboardingTerminado(mensajes: MensajeIA[]): boolean {
  // Si el historial tiene más de 12 mensajes, el onboarding ya terminó hace rato
  if (mensajes.length > 12) return true;
  // O si algún mensaje del asistente habla de "buscando rival" o herramientas
  return mensajes.some(m =>
    m.role === 'assistant' &&
    typeof m.content === 'string' &&
    (m.content.includes('buscando un rival') || m.content.includes('Estoy buscando') || m.content.includes('rival compatible'))
  );
}
