import WhatsApp from 'whatsapp-web.js';
const { Client, LocalAuth } = WhatsApp;
import qrcode from 'qrcode';
import logger from '../../utils/logger.js';

type WAMessage = WhatsApp.Message;

let waClient: WhatsApp.Client | null = null;
let qrDataUrl: string | null = null;
let isReady = false;

export function getWhatsAppClient(): WhatsApp.Client | null {
  return waClient;
}

export function getQrDataUrl(): string | null {
  return qrDataUrl;
}

export function isWhatsAppReady(): boolean {
  return isReady;
}

export function initWhatsApp(
  onMessage: (msg: WAMessage) => Promise<void>
): void {
  waClient = new Client({
    authStrategy: new LocalAuth({ dataPath: process.env.WHATSAPP_SESSION_PATH ?? './whatsapp-session' }),
    puppeteer: {
      headless: true,
      // Use system Edge (Chromium) instead of bundled Puppeteer Chrome
      executablePath: 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-accelerated-2d-canvas',
        '--no-first-run',
        '--no-zygote',
        '--disable-gpu',
      ],
    },
  });

  waClient.on('qr', async (qr: string) => {
    logger.info('WhatsApp QR code generated — scan to connect');
    try {
      qrDataUrl = await qrcode.toDataURL(qr);
    } catch {
      logger.warn('Could not generate QR data URL');
    }
  });

  waClient.on('ready', () => {
    isReady = true;
    qrDataUrl = null; // clear QR once authenticated
    logger.info('✅ WhatsApp client is ready');
  });

  waClient.on('disconnected', (reason: string) => {
    isReady = false;
    logger.warn(`WhatsApp disconnected: ${reason}`);
  });

  waClient.on('auth_failure', (msg: string) => {
    logger.error(`WhatsApp auth failure: ${msg}`);
  });

  waClient.on('message', async (msg: WhatsApp.Message) => {
    // Skip group messages and status updates
    if ((msg as any).isGroupMsg || msg.from === 'status@broadcast') return;

    logger.debug(`WhatsApp message from ${msg.from}: ${msg.body.slice(0, 100)}`);

    try {
      await onMessage(msg);
    } catch (err: any) {
      logger.error('Error processing WhatsApp message', { err: err.message });
    }
  });

  waClient.initialize().catch(err => {
    logger.error('WhatsApp initialization failed', { err: err.message });
  });
}
