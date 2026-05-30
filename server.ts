import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import { config, isDev } from './src/config/index.js';
import logger from './src/utils/logger.js';
import { generalLimiter } from './src/middleware/rate-limit.js';
import appRouter from './src/routes/index.js';
import { initWhatsApp } from './src/integrations/whatsapp/client.js';
import { handleIncomingWhatsAppMessage } from './src/integrations/whatsapp/handler.js';

const app = express();

// ── Security ──────────────────────────────────────────────────────────────────
app.use(helmet({
  crossOriginEmbedderPolicy: false, // needed for some calendar redirects
}));

app.use(cors({
  origin: [config.FRONTEND_URL, 'http://localhost:3000', 'http://localhost:3001'],
  credentials: true,
  methods: ['GET', 'POST', 'PATCH', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Tenant-ID', 'X-Tenant-Slug'],
}));

// ── Body parsing ──────────────────────────────────────────────────────────────
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true }));

// ── Logging ───────────────────────────────────────────────────────────────────
app.use(morgan(isDev ? 'dev' : 'combined', {
  stream: { write: (msg: string) => logger.http(msg.trim()) },
}));

// ── Rate limiting (global) ────────────────────────────────────────────────────
app.use(generalLimiter);

// ── Health check (no auth, no tenant required) ────────────────────────────────
app.get('/health', (_req, res) => {
  res.json({
    status: 'ok',
    service: 'Find Your Rival – AI Agent',
    version: '2.0.0',
    timestamp: new Date().toISOString(),
    env: config.NODE_ENV,
  });
});

// ── API Routes ────────────────────────────────────────────────────────────────
app.use('/', appRouter);

// ── 404 ───────────────────────────────────────────────────────────────────────
app.use((_req, res) => {
  res.status(404).json({ success: false, error: 'Route not found.' });
});

// ── Global error handler ──────────────────────────────────────────────────────
app.use((err: Error, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  logger.error('Unhandled error', { message: err.message, stack: isDev ? err.stack : undefined });
  res.status(500).json({ success: false, error: 'Internal server error.' });
});

// ── Start server ──────────────────────────────────────────────────────────────
const server = app.listen(config.PORT, () => {
  logger.info(`🚀 Find Your Rival API running on http://localhost:${config.PORT}`);
  logger.info(`   Health:         GET  http://localhost:${config.PORT}/health`);
  logger.info(`   AI Chat:        POST http://localhost:${config.PORT}/api/v1/ai/chat`);
  logger.info(`   Courts:         GET  http://localhost:${config.PORT}/api/v1/courts`);
  logger.info(`   Reservations:   GET  http://localhost:${config.PORT}/api/v1/reservations`);
  logger.info(`   WhatsApp QR:    GET  http://localhost:${config.PORT}/webhooks/whatsapp/qr`);
  logger.info(`   WhatsApp Status: GET http://localhost:${config.PORT}/webhooks/whatsapp/status`);

  // Start WhatsApp client in background
  initWhatsApp(handleIncomingWhatsAppMessage);
  logger.info('📱 WhatsApp client initialising...');
});

// ── Graceful shutdown ─────────────────────────────────────────────────────────
process.on('SIGTERM', () => {
  logger.info('SIGTERM received — shutting down gracefully');
  server.close(() => {
    logger.info('Server closed');
    process.exit(0);
  });
});

export default app;
