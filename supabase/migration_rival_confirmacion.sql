-- Migración: confirmación de disponibilidad del rival
ALTER TABLE "Solicitudes"
  ADD COLUMN IF NOT EXISTS rival_confirmacion_estado text DEFAULT NULL
    CHECK (rival_confirmacion_estado IN ('esperando', 'confirmado', 'rechazado'));

-- Índice para buscar rápido si hay rival esperando confirmación
CREATE INDEX IF NOT EXISTS idx_solicitudes_rival_conf
  ON "Solicitudes"(rival_telefono, rival_confirmacion_estado)
  WHERE rival_confirmacion_estado = 'esperando';
