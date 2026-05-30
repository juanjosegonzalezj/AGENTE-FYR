import { Router } from 'express';
import { z } from 'zod';
import { runAgent } from '../../ai/agent.js';
import { getPlayerByPhone } from '../../db/queries/players.js';
import { aiChatLimiter } from '../../middleware/rate-limit.js';
import type { Request, Response } from 'express';

const router = Router();

const chatSchema = z.object({
  message: z.string().min(1).max(2000),
  conversation_id: z.string().uuid().optional(),
  player_phone: z.string().optional(),
});

// POST /api/v1/ai/chat
router.post('/chat', aiChatLimiter, async (req: Request, res: Response) => {
  try {
    if (!req.complex) {
      return res.status(400).json({ success: false, error: 'Complex context required.' });
    }

    const parsed = chatSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ success: false, error: parsed.error.flatten() });
    }

    const { message, conversation_id, player_phone } = parsed.data;

    // Resolve player context
    const player = player_phone
      ? await getPlayerByPhone(player_phone, req.tenantId)
      : null;

    const result = await runAgent(
      message,
      {
        complex: req.complex,
        player,
        channel: 'web',
        channelUserId: player_phone ?? req.userId ?? 'anonymous',
      },
      conversation_id
    );

    res.json({
      success: true,
      data: {
        reply: result.reply,
        conversation_id: result.conversationId,
        tools_used: result.toolsUsed,
      },
    });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

export default router;
