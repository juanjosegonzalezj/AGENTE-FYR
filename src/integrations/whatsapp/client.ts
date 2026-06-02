import WhatsApp from 'whatsapp-web.js';
const { Client, LocalAuth } = WhatsApp;
import qrcode from 'qrcode';
import fs from 'fs';
import logger from '../../utils/logger.js';

type WAMessage = WhatsApp.Message;

let waClient: WhatsApp.Client | null = null;
let qrDataUrl: string | null = null;
let isReady = false;

export function getWhatsAppClient(): WhatsApp.Client | null { return waClient; }
export function getQrDataUrl(): string | null { return qrDataUrl; }
export function isWhatsAppReady(): boolean { return isReady; }

// Detecta la ruta del navegador disponible en el sistema
function detectarNavegador(): string | undefined {
  const candidatos = [
    'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
    'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe',
    'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
  ];
  for (const ruta of candidatos) {
    if (fs.existsSync(ruta)) {
      logger.info(`Navegador encontrado: ${ruta}`);
      return ruta;
    }
  }
  logger.warn('No se encontró Chrome ni Edge — usando Chromium bundled');
  return undefined;
}

export function initWhatsApp(
  onMessage: (msg: WAMessage) => Promise<void>
): void {
  const executablePath = detectarNavegador();

  waClient = new Client({
    authStrategy: new LocalAuth({
      dataPath: process.env.WHATSAPP_SESSION_PATH ?? './whatsapp-session',
    }),
    puppeteer: {
      headless: true,
      ...(executablePath ? { executablePath } : {}),
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-gpu',
        '--disable-extensions',
        '--disable-background-networking',
        '--no-first-run',
        '--disable-default-apps',
        '--disable-sync',
        '--metrics-recording-only',
        '--safebrowsing-disable-auto-update',
        '--password-store=basic',
        '--use-mock-keychain',
      ],
    },
  });

  waClient.on('qr', async (qr: string) => {
    logger.info('QR generado — escanea con WhatsApp');

    try {
      const qrText = await qrcode.toString(qr, { type: 'terminal', small: true });
      console.log('\n' + '='.repeat(60));
      console.log('  📱  ESCANEA ESTE QR CON WHATSAPP');
      console.log('='.repeat(60));
      console.log(qrText);
      console.log('  WhatsApp → ⋮ → Dispositivos vinculados → Vincular');
      console.log('='.repeat(60) + '\n');
    } catch {
      logger.info('QR disponible en http://localhost:3001/whatsapp/qr');
    }

    try {
      qrDataUrl = await qrcode.toDataURL(qr);
    } catch {
      logger.warn('No se pudo generar QR data URL');
    }
  });

  waClient.on('ready', () => {
    isReady = true;
    qrDataUrl = null;
    logger.info('✅ WhatsApp listo y conectado');
  });

  waClient.on('disconnected', (reason: string) => {
    isReady = false;
    logger.warn(`WhatsApp desconectado: ${reason}`);
  });

  waClient.on('auth_failure', (msg: string) => {
    logger.error(`WhatsApp auth failure: ${msg}`);
  });

  waClient.on('message', async (msg: WhatsApp.Message) => {
    if ((msg as any).isGroupMsg || msg.from === 'status@broadcast') return;
    try {
      await onMessage(msg);
    } catch (err: any) {
      logger.error('Error procesando mensaje WhatsApp', { err: err?.message ?? String(err) });
    }
  });

  waClient.initialize().catch((err: unknown) => {
    const mensaje = err instanceof Error ? err.message : String(err);
    const stack   = err instanceof Error ? err.stack : '';
    logger.error(`WhatsApp initialization failed: ${mensaje}`);
    if (stack) logger.error(stack);
  });
}
