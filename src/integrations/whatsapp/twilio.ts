import axios from 'axios';
import { config } from '../../config/index.js';
import logger from '../../utils/logger.js';

const MAX_LENGTH = 1600;

function asTwilioWhatsappAddress(phone: string): string {
  const normalized = phone.startsWith('whatsapp:') ? phone : `whatsapp:${phone}`;
  return normalized;
}

export function isTwilioConfigured(): boolean {
  return Boolean(
    config.TWILIO_ACCOUNT_SID &&
    config.TWILIO_AUTH_TOKEN &&
    config.TWILIO_WHATSAPP_FROM
  );
}

export async function sendTwilioWhatsAppMessage(to: string, body: string): Promise<boolean> {
  if (!isTwilioConfigured()) {
    logger.warn('Twilio WhatsApp is not configured.');
    return false;
  }

  const url = `https://api.twilio.com/2010-04-01/Accounts/${config.TWILIO_ACCOUNT_SID}/Messages.json`;
  const params = new URLSearchParams({
    From: asTwilioWhatsappAddress(config.TWILIO_WHATSAPP_FROM!),
    To: asTwilioWhatsappAddress(to),
    Body: body.length > MAX_LENGTH ? `${body.slice(0, MAX_LENGTH - 3)}...` : body,
  });

  try {
    await axios.post(url, params, {
      auth: {
        username: config.TWILIO_ACCOUNT_SID!,
        password: config.TWILIO_AUTH_TOKEN!,
      },
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    });
    logger.debug(`Twilio WhatsApp message sent to ${to}`);
    return true;
  } catch (err: any) {
    logger.error(`Failed to send Twilio WhatsApp message to ${to}`, {
      err: err.response?.data?.message ?? err.message,
    });
    return false;
  }
}

export function twimlMessage(message: string): string {
  const escaped = message
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');

  return `<?xml version="1.0" encoding="UTF-8"?><Response><Message>${escaped}</Message></Response>`;
}
