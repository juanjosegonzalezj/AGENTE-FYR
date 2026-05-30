import { db } from '../client.js';
import type { Message, AnthropicMessage, MessageChannel } from '../../types/index.js';
import { v4 as uuidv4 } from 'uuid';

export interface ConversationRecord {
  id: string;
  complex_id: string | null;
  player_id: string | null;
  channel: MessageChannel;
  channel_user_id: string | null;
  messages: AnthropicMessage[];
  last_message_at: string | null;
  created_at: string;
  updated_at: string;
}

export async function getOrCreateConversation(
  channel: MessageChannel,
  channelUserId: string,
  complexId?: string,
  playerId?: string
): Promise<ConversationRecord> {
  // Try to find an existing active conversation (within 24h)
  const cutoff = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

  const { data: existing } = await db.client
    .from('conversations')
    .select('*')
    .eq('channel', channel)
    .eq('channel_user_id', channelUserId)
    .gte('last_message_at', cutoff)
    .order('last_message_at', { ascending: false })
    .limit(1)
    .single();

  if (existing) return existing as ConversationRecord;

  // Create a new conversation
  const { data, error } = await db.client
    .from('conversations')
    .insert({
      id: uuidv4(),
      complex_id: complexId ?? null,
      player_id: playerId ?? null,
      channel,
      channel_user_id: channelUserId,
      messages: [],
      last_message_at: new Date().toISOString(),
    })
    .select()
    .single();

  if (error) throw new Error(`Failed to create conversation: ${error.message}`);
  return data as ConversationRecord;
}

export async function appendMessages(
  conversationId: string,
  newMessages: AnthropicMessage[]
): Promise<void> {
  const { data: conv, error: fetchErr } = await db.client
    .from('conversations')
    .select('messages')
    .eq('id', conversationId)
    .single();

  if (fetchErr) throw new Error(`Failed to fetch conversation: ${fetchErr.message}`);

  const existing: AnthropicMessage[] = conv?.messages ?? [];

  // Keep last 40 messages to bound context window growth
  const combined = [...existing, ...newMessages].slice(-40);

  const { error } = await db.client
    .from('conversations')
    .update({
      messages: combined,
      last_message_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq('id', conversationId);

  if (error) throw new Error(`Failed to update conversation: ${error.message}`);
}

export async function getConversationById(id: string): Promise<ConversationRecord | null> {
  const { data, error } = await db.client
    .from('conversations')
    .select('*')
    .eq('id', id)
    .single();

  if (error || !data) return null;
  return data as ConversationRecord;
}

export async function logMessage(payload: Partial<Message>): Promise<void> {
  await db.client.from('messages').insert(payload);
}
