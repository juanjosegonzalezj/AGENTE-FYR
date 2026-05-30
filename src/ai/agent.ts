import Anthropic from '@anthropic-ai/sdk';
import { config } from '../config/index.js';
import { buildSystemPrompt } from './prompts.js';
import { TOOL_DEFINITIONS } from './tools/index.js';
import { getAvailableCourts } from './tools/availability.js';
import { createBooking, cancelBooking, rescheduleBooking, getReservationDetails } from './tools/booking.js';
import { findOpponents } from './tools/matchmaking.js';
import { getPlayerProfile } from './tools/players.js';
import { getComplexInformation } from './tools/complex.js';
import {
  getOrCreateConversation,
  appendMessages,
} from '../db/queries/messages.js';
import type { SportsComplex, Player, AnthropicMessage, MessageChannel } from '../types/index.js';
import logger from '../utils/logger.js';

const anthropic = new Anthropic({ apiKey: config.ANTHROPIC_API_KEY });

const MODEL = 'claude-sonnet-4-6';
const MAX_TOKENS = 1024;
const MAX_TOOL_ROUNDS = 6; // safety limit

interface AgentContext {
  complex: SportsComplex;
  player: Player | null;
  channel: MessageChannel;
  channelUserId: string;
}

interface AgentResponse {
  reply: string;
  conversationId: string;
  toolsUsed: string[];
}

// Execute a tool call and return the result as a string
async function executeTool(
  toolName: string,
  toolInput: Record<string, unknown>,
  ctx: AgentContext
): Promise<string> {
  const { complex, player } = ctx;

  try {
    switch (toolName) {
      case 'get_available_courts': {
        const result = await getAvailableCourts(
          complex.id,
          complex.timezone,
          toolInput as any
        );
        return JSON.stringify(result);
      }

      case 'create_booking': {
        const result = await createBooking(
          complex.id,
          player?.id ?? null,
          {
            ...toolInput,
            player_name: toolInput.player_name as string ?? player?.full_name,
          } as any
        );
        return JSON.stringify(result);
      }

      case 'cancel_booking': {
        const result = await cancelBooking(complex.id, toolInput as any);
        return JSON.stringify(result);
      }

      case 'reschedule_booking': {
        const result = await rescheduleBooking(complex.id, toolInput as any);
        return JSON.stringify(result);
      }

      case 'find_opponents': {
        if (!player) {
          return JSON.stringify({ found: false, message: 'Debes tener un perfil de jugador para buscar rivales.' });
        }
        const result = await findOpponents(complex.id, player.id, toolInput as any);
        return JSON.stringify(result);
      }

      case 'get_player_profile': {
        const result = await getPlayerProfile(
          toolInput.player_id as string,
          complex.id
        );
        return JSON.stringify(result);
      }

      case 'get_complex_information': {
        const result = await getComplexInformation(complex);
        return JSON.stringify(result);
      }

      case 'get_reservation_details': {
        const result = await getReservationDetails(
          toolInput.reservation_id as string,
          complex.id
        );
        return JSON.stringify(result);
      }

      default:
        return JSON.stringify({ error: `Unknown tool: ${toolName}` });
    }
  } catch (err: any) {
    logger.error(`Tool execution error: ${toolName}`, { err: err.message });
    return JSON.stringify({ error: `Tool error: ${err.message}` });
  }
}

export async function runAgent(
  userMessage: string,
  ctx: AgentContext,
  existingConversationId?: string
): Promise<AgentResponse> {
  const { complex, player, channel, channelUserId } = ctx;

  // 1. Load or create conversation
  const conversation = existingConversationId
    ? await (async () => {
        const { getConversationById } = await import('../db/queries/messages.js');
        return getConversationById(existingConversationId);
      })()
    : null;

  const conv = conversation ?? await getOrCreateConversation(
    channel,
    channelUserId,
    complex.id,
    player?.id
  );

  const conversationId = conv.id;

  // 2. Build message history
  const history: AnthropicMessage[] = [...(conv.messages ?? [])];
  const newUserMessage: AnthropicMessage = { role: 'user', content: userMessage };
  history.push(newUserMessage);

  // 3. Build system prompt with context
  const systemPrompt = buildSystemPrompt(complex, player, channel);

  // 4. Agentic loop
  const toolsUsed: string[] = [];
  let currentMessages: Anthropic.MessageParam[] = history.map(m => ({
    role: m.role,
    content: typeof m.content === 'string' ? m.content : m.content as Anthropic.ContentBlockParam[],
  }));

  for (let round = 0; round < MAX_TOOL_ROUNDS; round++) {
    logger.debug(`Agent round ${round + 1}`, { conversationId });

    const response = await anthropic.messages.create({
      model: MODEL,
      max_tokens: MAX_TOKENS,
      system: systemPrompt,
      tools: TOOL_DEFINITIONS,
      messages: currentMessages,
    });

    logger.debug(`Stop reason: ${response.stop_reason}`);

    if (response.stop_reason === 'end_turn') {
      // Final text response
      const textBlock = response.content.find(b => b.type === 'text');
      const reply = textBlock && textBlock.type === 'text' ? textBlock.text : '¿Puedo ayudarte en algo más?';

      // Persist new messages (user + assistant)
      await appendMessages(conversationId, [
        newUserMessage,
        { role: 'assistant', content: reply },
      ]);

      return { reply, conversationId, toolsUsed };
    }

    if (response.stop_reason === 'tool_use') {
      // Process all tool calls in parallel
      const toolUseBlocks = response.content.filter(b => b.type === 'tool_use');
      const toolResults: Anthropic.ToolResultBlockParam[] = [];

      for (const block of toolUseBlocks) {
        if (block.type !== 'tool_use') continue;
        toolsUsed.push(block.name);
        logger.info(`Calling tool: ${block.name}`, { input: block.input });

        const result = await executeTool(
          block.name,
          block.input as Record<string, unknown>,
          ctx
        );

        toolResults.push({
          type: 'tool_result',
          tool_use_id: block.id,
          content: result,
        });
      }

      // Append assistant message (with tool_use) + tool results to history
      currentMessages = [
        ...currentMessages,
        { role: 'assistant', content: response.content },
        { role: 'user', content: toolResults },
      ] as Anthropic.MessageParam[];

      continue;
    }

    // Unexpected stop reason
    break;
  }

  // Fallback if max rounds exceeded
  const fallback = 'Lo siento, estoy teniendo problemas para procesar tu solicitud. Por favor intenta de nuevo.';
  await appendMessages(conversationId, [newUserMessage, { role: 'assistant', content: fallback }]);
  return { reply: fallback, conversationId, toolsUsed };
}
