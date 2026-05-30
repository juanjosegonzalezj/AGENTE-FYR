require('dotenv').config();

const express = require('express');
const cors = require('cors');
const logger = require('./src/utils/logger');
const matchmakingRoutes = require('./src/routes/matchmakingRoutes');
const whatsappRoutes = require('./src/routes/whatsappRoutes');
const { initWhatsApp } = require('./src/services/whatsappService');

const app = express();
const PORT = process.env.PORT || 3001;

// ── Middleware ────────────────────────────────────────────────────────────────
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// ── Request logger ────────────────────────────────────────────────────────────
app.use((req, _res, next) => {
  logger.debug(`${req.method} ${req.path}`);
  next();
});

// ── Rutas ─────────────────────────────────────────────────────────────────────
app.use('/', matchmakingRoutes);
app.use('/whatsapp', whatsappRoutes);

// ── Health check ──────────────────────────────────────────────────────────────
app.get('/health', (_req, res) => {
  res.json({ status: 'ok', service: 'FYR Agent Backend', timestamp: new Date().toISOString() });
});

// ── 404 ───────────────────────────────────────────────────────────────────────
app.use((_req, res) => {
  res.status(404).json({ success: false, message: 'Ruta no encontrada' });
});

// ── Error handler ─────────────────────────────────────────────────────────────
app.use((err, _req, res, _next) => {
  logger.error('Error no manejado:', err.message);
  res.status(500).json({ success: false, message: 'Error interno del servidor' });
});

// ── Arranque ──────────────────────────────────────────────────────────────────
app.listen(PORT, () => {
  logger.success(`Servidor corriendo en http://localhost:${PORT}`);
  logger.info(`QR de WhatsApp disponible en http://localhost:${PORT}/whatsapp/qr`);
  logger.info(`Estado de WhatsApp:          http://localhost:${PORT}/whatsapp/status`);
  logger.info(`Health check:                http://localhost:${PORT}/health`);
  logger.info(`Endpoint matchmaking:  POST  http://localhost:${PORT}/join-matchmaking`);

  // Inicia WhatsApp Web en paralelo (no bloquea el servidor)
  initWhatsApp();
});
