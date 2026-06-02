import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import path from 'path';
import { config, isDev } from './src/config/index.js';
import logger from './src/utils/logger.js';
import { generalLimiter } from './src/middleware/rate-limit.js';
import { initWhatsApp, getQrDataUrl, isWhatsAppReady } from './src/integrations/whatsapp/client.js';
import { handleIncomingWhatsAppMessage, handleIncomingWhatsAppText } from './src/integrations/whatsapp/handler.js';
import { twimlMessage } from './src/integrations/whatsapp/twilio.js';
import { iniciarJobRecordatorios } from './src/jobs/reminders.js';
import { iniciarJobsMatchmaking } from './src/jobs/matchmaker.js';
import { runAgent } from './src/ai/agent.js';

const app = express();

app.use(helmet({ crossOriginEmbedderPolicy: false }));
app.use(cors({
  origin: [config.FRONTEND_URL, 'http://localhost:3000', 'http://localhost:3001'],
  credentials: true,
  methods: ['GET', 'POST', 'PATCH', 'PUT', 'DELETE', 'OPTIONS'],
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
    status: 'ok',
    service: 'Lucia - Find Your Rival AI Agent',
    version: '3.0.0',
    timestamp: new Date().toISOString(),
    env: config.NODE_ENV,
  });
});

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
    console.error('\nERROR AGENTE:', msg);
    console.error(stack);
    logger.error('Error en /api/chat', { error: msg });
    res.status(500).json({ success: false, error: 'Error interno del agente.', detalle: msg });
  }
});

app.post('/webhooks/whatsapp/twilio', async (req, res) => {
  const from = String(req.body.From ?? '').replace(/^whatsapp:/, '');
  const to = String(req.body.To ?? '').replace(/^whatsapp:/, '');
  const text = String(req.body.Body ?? '').trim();

  if (!from || !to || !text) {
    return res.type('text/xml').send(twimlMessage('No pude leer tu mensaje. Intenta de nuevo, por favor.'));
  }

  try {
    const reply = await handleIncomingWhatsAppText({ from, to, text });
    return res.type('text/xml').send(twimlMessage(reply));
  } catch (err: any) {
    const msg = err?.message ?? String(err);
    logger.error('Error en webhook Twilio WhatsApp', { error: msg });
    return res.type('text/xml').send(twimlMessage('Tuve un problema procesando el mensaje. Intenta de nuevo en un momento.'));
  }
});

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

app.use((_req, res) => {
  res.status(404).json({ success: false, error: 'Ruta no encontrada.' });
});

app.use((err: Error, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  logger.error('Error no manejado', { message: err.message });
  res.status(500).json({ success: false, error: 'Error interno del servidor.' });
});

const server = app.listen(config.PORT, () => {
  logger.info(`Lucia API corriendo en http://localhost:${config.PORT}`);
  logger.info('   Health:  GET  /health');
  logger.info('   Chat:    POST /api/chat');
  logger.info(`   QR:      GET  http://localhost:${config.PORT}/whatsapp/qr`);

  if (config.WHATSAPP_PROVIDER === 'webjs') {
    initWhatsApp(handleIncomingWhatsAppMessage);
    logger.info('WhatsApp Web inicializando...');
  } else {
    logger.info(`Twilio WhatsApp webhook ready: POST ${config.APP_URL}/webhooks/whatsapp/twilio`);
  }

  iniciarJobRecordatorios();
  iniciarJobsMatchmaking();
  logger.info('Jobs de recordatorios y matchmaking activos');
});

process.on('SIGTERM', () => {
  logger.info('SIGTERM - apagando...');
  server.close(() => process.exit(0));
});

export default app;
