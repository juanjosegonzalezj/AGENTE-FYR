import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import { config, isDev } from './src/config/index.js';
import logger from './src/utils/logger.js';
import { generalLimiter } from './src/middleware/rate-limit.js';
import { handleTwilioWebhook } from './src/integrations/twilio/handler.js';
import { iniciarJobRecordatorios } from './src/jobs/reminders.js';
import { iniciarJobsMatchmaking } from './src/jobs/matchmaker.js';
import { runAgent } from './src/ai/agent.js';

const app = express();

app.use(helmet({ crossOriginEmbedderPolicy: false }));
app.use(cors({
  origin:         ['*'],
  methods:        ['GET', 'POST', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
}));

app.use(express.json({ limit: '2mb' }));
app.use(express.urlencoded({ extended: true }));

app.use(morgan(isDev ? 'dev' : 'combined', {
  stream: { write: (msg: string) => logger.http(msg.trim()) },
}));

app.use(generalLimiter);

app.get('/health', (_req, res) => {
  res.json({
    status:    'ok',
    service:   'Lucía – Find Your Rival',
    version:   '3.0.0',
    timestamp: new Date().toISOString(),
  });
});

// Twilio envía mensajes de WhatsApp aquí
app.post('/webhooks/twilio', handleTwilioWebhook);

// API de prueba local
app.post('/api/chat', async (req, res) => {
  const { mensaje, telefono } = req.body ?? {};
  if (!mensaje || !telefono) {
    return res.status(400).json({ success: false, error: 'Faltan campos mensaje y telefono.' });
  }
  try {
    const { reply, herramientas_usadas } = await runAgent(mensaje, telefono);
    res.json({ success: true, data: { reply, herramientas_usadas } });
  } catch (err: any) {
    const msg = err?.message ?? String(err);
    logger.error('Error agente', { error: msg });
    res.status(500).json({ success: false, error: msg });
  }
});

app.use((_req, res) => {
  res.status(404).json({ success: false, error: 'Ruta no encontrada.' });
});

app.use((err: Error, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  logger.error('Error no manejado', { message: err.message });
  res.status(500).json({ success: false, error: 'Error interno.' });
});

const server = app.listen(config.PORT, () => {
  logger.info(`🚀 Lucía corriendo en puerto ${config.PORT}`);
  logger.info(`   Webhook Twilio: POST /webhooks/twilio`);
  logger.info(`   Health:         GET  /health`);

  iniciarJobRecordatorios();
  iniciarJobsMatchmaking();
  logger.info('⏱️  Jobs activos (recordatorios + matchmaking)');
});

process.on('SIGTERM', () => {
  server.close(() => process.exit(0));
});

export default app;
