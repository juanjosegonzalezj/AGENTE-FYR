import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import { config, isDev } from './src/config/index.js';
import logger from './src/utils/logger.js';
import { generalLimiter } from './src/middleware/rate-limit.js';
import path from 'path';
import { initWhatsApp, getQrDataUrl, isWhatsAppReady } from './src/integrations/whatsapp/client.js';
import { handleIncomingWhatsAppMessage } from './src/integrations/whatsapp/handler.js';
import { iniciarJobRecordatorios } from './src/jobs/reminders.js';
import { iniciarJobsMatchmaking } from './src/jobs/matchmaker.js';
import { runAgent } from './src/ai/agent.js';

const app = express();

// ── Seguridad ─────────────────────────────────────────────────────────────────
app.use(helmet({ crossOriginEmbedderPolicy: false }));
app.use(cors({
  origin:         [config.FRONTEND_URL, 'http://localhost:3000', 'http://localhost:3001'],
  credentials:    true,
  methods:        ['GET', 'POST', 'PATCH', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
}));

// ── Parsers ───────────────────────────────────────────────────────────────────
app.use(express.json({ limit: '2mb' }));
app.use(express.urlencoded({ extended: true }));

// ── Logging ───────────────────────────────────────────────────────────────────
app.use(morgan(isDev ? 'dev' : 'combined', {
  stream: { write: (msg: string) => logger.http(msg.trim()) },
}));

// ── Rate limiting ─────────────────────────────────────────────────────────────
app.use(generalLimiter);

// ── Health check ──────────────────────────────────────────────────────────────
app.get('/health', (_req, res) => {
  res.json({
    status:    'ok',
    service:   'Lucía – Find Your Rival AI Agent',
    version:   '3.0.0',
    timestamp: new Date().toISOString(),
    env:       config.NODE_ENV,
  });
});

// ── Chat API (Web / testing) ──────────────────────────────────────────────────
app.post('/api/chat', async (req, res) => {
  const { mensaje, telefono } = req.body ?? {};

  if (!mensaje || typeof mensaje !== 'string') {
    return res.status(400).json({ success: false, error: 'Campo "mensaje" requerido.' });
  }
  if (!telefono || typeof telefono !== 'string') {
    return res.status(400).json({ success: false, error: 'Campo "telefono" requerido.' });
  }

  try {
    const { reply, herramientas_usadas } = await runAgent(mensaje, telefono);
    res.json({ success: true, data: { reply, herramientas_usadas } });
  } catch (err: any) {
    const msg = err?.message ?? String(err);
    const stack = err?.stack ?? '';
    console.error('\n❌ ERROR AGENTE:', msg);
    console.error(stack);
    logger.error('Error en /api/chat', { error: msg });
    res.status(500).json({ success: false, error: 'Error interno del agente.', detalle: msg });
  }
});

// ── WhatsApp QR ───────────────────────────────────────────────────────────────
app.get('/whatsapp/qr', (_req, res) => {
  res.sendFile(path.join(process.cwd(), 'qr.html'));
});

app.get('/webhooks/whatsapp/qr', (_req, res) => {
  if (isWhatsAppReady()) {
    return res.json({ status: 'connected' });
  }
  const qr = getQrDataUrl();
  res.json({ status: qr ? 'pending' : 'initializing', qr_data_url: qr ?? null });
});

// ── 404 ───────────────────────────────────────────────────────────────────────
app.use((_req, res) => {
  res.status(404).json({ success: false, error: 'Ruta no encontrada.' });
});

// ── Error handler ─────────────────────────────────────────────────────────────
app.use((err: Error, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  logger.error('Error no manejado', { message: err.message });
  res.status(500).json({ success: false, error: 'Error interno del servidor.' });
});

// ── Iniciar servidor ──────────────────────────────────────────────────────────
const server = app.listen(config.PORT, () => {
  logger.info(`🚀 Lucía API corriendo en http://localhost:${config.PORT}`);
  logger.info(`   Health:  GET  /health`);
  logger.info(`   Chat:    POST /api/chat`);
  logger.info(`   QR:      GET  http://localhost:${config.PORT}/whatsapp/qr  ← abre en el navegador`);

  // WhatsApp
  initWhatsApp(handleIncomingWhatsAppMessage);
  logger.info('📱 WhatsApp inicializando...');

  // Jobs en background
  iniciarJobRecordatorios();
  iniciarJobsMatchmaking();
  logger.info('⏱️  Jobs de recordatorios y matchmaking activos');
});

// ── Graceful shutdown ─────────────────────────────────────────────────────────
process.on('SIGTERM', () => {
  logger.info('SIGTERM – apagando...');
  server.close(() => process.exit(0));
});

export default app;
