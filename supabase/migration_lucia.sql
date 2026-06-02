-- ============================================================
-- Migración Lucía – Find Your Rival
-- Ejecutar en Supabase SQL Editor
-- ============================================================

-- 1. Columnas faltantes en Solicitudes
ALTER TABLE "Solicitudes"
  ADD COLUMN IF NOT EXISTS busqueda_activa     boolean   DEFAULT true,
  ADD COLUMN IF NOT EXISTS notificado_sin_rival boolean  DEFAULT false;

-- 2. Tabla Reservas (canchas)
CREATE TABLE IF NOT EXISTS "Reservas" (
  id                        bigserial PRIMARY KEY,
  created_at                timestamptz DEFAULT now(),
  solicitud_1_id            bigint REFERENCES "Solicitudes"(id) ON DELETE SET NULL,
  solicitud_2_id            bigint REFERENCES "Solicitudes"(id) ON DELETE SET NULL,
  capitan_1                 text        NOT NULL,
  capitan_2                 text        NOT NULL,
  telefono_1                text        NOT NULL,
  telefono_2                text        NOT NULL,
  deporte                   public.deporte_tipo NOT NULL,
  cancha                    text        NOT NULL,
  fecha                     date        NOT NULL,
  hora_inicio               text        NOT NULL,   -- "10:00"
  hora_fin                  text        NOT NULL,   -- "11:00"
  estado_pago               text        NOT NULL DEFAULT 'pendiente_pago'
                              CHECK (estado_pago IN ('pendiente_pago','confirmado')),
  comprobante_url           text,
  estado_reserva            text        NOT NULL DEFAULT 'pendiente'
                              CHECK (estado_reserva IN ('pendiente','reservada','cancelada','completada')),
  google_calendar_event_id  text,
  recordatorio_enviado      boolean     DEFAULT false,
  recordatorio_enviado_at   timestamptz,
  valor_total               numeric(10,2),
  notas                     text
);

-- 3. Tabla Conversaciones (historial AI por WhatsApp)
CREATE TABLE IF NOT EXISTS "Conversaciones" (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  telefono    text        NOT NULL UNIQUE,
  mensajes    jsonb       NOT NULL DEFAULT '[]'::jsonb,
  created_at  timestamptz DEFAULT now(),
  updated_at  timestamptz DEFAULT now()
);

-- 4. Índices de rendimiento
CREATE INDEX IF NOT EXISTS idx_solicitudes_estado
  ON "Solicitudes"(estado);
CREATE INDEX IF NOT EXISTS idx_solicitudes_busqueda
  ON "Solicitudes"(busqueda_activa, estado, fecha_solicitud);
CREATE INDEX IF NOT EXISTS idx_solicitudes_deporte
  ON "Solicitudes"(deporte);
CREATE INDEX IF NOT EXISTS idx_solicitudes_telefono
  ON "Solicitudes"(telefono);

CREATE INDEX IF NOT EXISTS idx_reservas_estado
  ON "Reservas"(estado_reserva);
CREATE INDEX IF NOT EXISTS idx_reservas_recordatorio
  ON "Reservas"(recordatorio_enviado, estado_reserva, fecha, hora_inicio);
CREATE INDEX IF NOT EXISTS idx_reservas_fecha
  ON "Reservas"(fecha);
CREATE INDEX IF NOT EXISTS idx_reservas_telefono
  ON "Reservas"(telefono_1, telefono_2);

CREATE INDEX IF NOT EXISTS idx_conversaciones_telefono
  ON "Conversaciones"(telefono);
CREATE INDEX IF NOT EXISTS idx_capitanes_deporte
  ON "Capitanes"(sport_type);
CREATE INDEX IF NOT EXISTS idx_clientes_deporte
  ON "Clientes"(sport_type);

-- 5. RLS - Acceso público por servicio (service_role bypasses RLS)
ALTER TABLE "Reservas"      ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Conversaciones" ENABLE ROW LEVEL SECURITY;

-- Política: solo service_role puede leer/escribir (el backend usa service_role key)
CREATE POLICY "service_only" ON "Reservas"
  USING (false) WITH CHECK (false);
CREATE POLICY "service_only" ON "Conversaciones"
  USING (false) WITH CHECK (false);
