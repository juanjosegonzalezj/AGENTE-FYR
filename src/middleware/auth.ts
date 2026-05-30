import type { Request, Response, NextFunction } from 'express';
import { getAnonClient } from '../db/client.js';
import logger from '../utils/logger.js';

// Validates Supabase JWT from Authorization header.
// Sets req.userId on success.
export async function authMiddleware(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith('Bearer ')) {
    res.status(401).json({ success: false, error: 'Missing or invalid Authorization header.' });
    return;
  }

  const token = authHeader.slice(7);
  const supabase = getAnonClient();

  const { data, error } = await supabase.auth.getUser(token);

  if (error || !data.user) {
    logger.warn('Auth failed', { error: error?.message });
    res.status(401).json({ success: false, error: 'Invalid or expired token.' });
    return;
  }

  req.userId = data.user.id;
  next();
}

// Optional auth — sets req.userId if token present, but doesn't fail
export async function optionalAuthMiddleware(
  req: Request,
  _res: Response,
  next: NextFunction
): Promise<void> {
  const authHeader = req.headers.authorization;
  if (authHeader?.startsWith('Bearer ')) {
    const token = authHeader.slice(7);
    const supabase = getAnonClient();
    const { data } = await supabase.auth.getUser(token);
    if (data.user) req.userId = data.user.id;
  }
  next();
}
