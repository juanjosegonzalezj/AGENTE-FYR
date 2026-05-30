import type WhatsApp from 'whatsapp-web.js';
import { runAgent } from '../../ai/agent.js';
import { getComplexByWhatsappNumber } from '../../db/queries/complexes.js';
import { getPlayerByPhone } from '../../db/queries/players.js';
import { getOrCreateConversation } from '../../db/queries/messages.js';
import { sendWhatsAppMessage } from './sender.js';
import logger from '../../utils/logger.js';

// Normalise WhatsApp "from" field to E.164 phone number
function extractPhone(from: string): string {
  // from looks like "34612345678@c.us"
  const digits = from.replace('@c.us', '').replace('@s.whatsapp.net', '');
  return `+${digits}`;
}

export async function handleIncomingWhatsAppMessage(msg: WhatsApp.Message): Promise<void> {
  const phone = extractPhone(msg.from);
  const text = msg.body?.trim();

  if (!text) return;

  logger.info(`WhatsApp message from ${phone}: "${text.slice(0, 80)}"`);

  // 1. Identify which sports complex this WhatsApp number belongs to
  //    The msg.to field is the WhatsApp number of our business account
  const recipientPhone = extractPhone(msg.to ?? '');
  const complex = await getComplexByWhatsappNumber(recipientPhone);

  if (!complex) {
    logger.warn(`No complex found for WhatsApp number: ${recipientPhone}`);
    await sendWhatsAppMessage(phone, 'Lo siento, este número no está asociado a ningún centro deportivo activo.');
    return;
  }

  // 2. Find or build player profile from phone
  const player = await getPlayerByPhone(phone, complex.id);

  // 3. Load conversation context
  const conversation = await getOrCreateConversation(
    'whatsapp',
    phone,
    complex.id,
    player?.id
  );

  // 4. Show typing indicator (if available)
  try {
    const chat = await msg.getChat();
    await chat.sendStateTyping();
  } catch {
    // Typing state not critical
  }

  // 5. Run AI agent
  const { reply } = await runAgent(text, {
    complex,
    player,
    channel: 'whatsapp',
    channelUserId: phone,
  }, conversation.id);

  // 6. Send reply
  await sendWhatsAppMessage(phone, reply);
}
