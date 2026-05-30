import { Router } from 'express';
import type { Request, Response } from 'express';

const router = Router();

// GET /webhooks/whatsapp/qr — serve QR code image
router.get('/qr', (_req: Request, res: Response) => {
  const { getQrDataUrl, isWhatsAppReady } = require('../../integrations/whatsapp/client.js');

  if (isWhatsAppReady()) {
    return res.json({ success: true, status: 'connected', message: 'WhatsApp already connected.' });
  }

  const qr = getQrDataUrl();
  if (!qr) {
    return res.json({ success: false, status: 'initializing', message: 'QR not generated yet. Please wait...' });
  }

  res.json({ success: true, status: 'pending', qr_data_url: qr });
});

// GET /webhooks/whatsapp/status
router.get('/status', (_req: Request, res: Response) => {
  const { isWhatsAppReady } = require('../../integrations/whatsapp/client.js');
  res.json({
    success: true,
    connected: isWhatsAppReady(),
    status: isWhatsAppReady() ? 'connected' : 'disconnected',
  });
});

export default router;
