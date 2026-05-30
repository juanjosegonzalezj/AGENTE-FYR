import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { config } from '../config/index.js';
import logger from '../utils/logger.js';

// Service-role client — full DB access, bypasses RLS.
// ONLY use server-side. Never expose to the browser.
let _serviceClient: SupabaseClient | null = null;

export function getServiceClient(): SupabaseClient {
  if (!_serviceClient) {
    const key = config.SUPABASE_SERVICE_ROLE_KEY ?? config.SUPABASE_ANON_KEY;
    _serviceClient = createClient(config.SUPABASE_URL, key, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    logger.debug('Supabase service client initialised');
  }
  return _serviceClient;
}

// Anon client — for operations that respect RLS (e.g. auth flows)
let _anonClient: SupabaseClient | null = null;

export function getAnonClient(): SupabaseClient {
  if (!_anonClient) {
    _anonClient = createClient(config.SUPABASE_URL, config.SUPABASE_ANON_KEY);
  }
  return _anonClient;
}

// Convenience alias — most backend code uses the service client
export const db = {
  get client() { return getServiceClient(); },
};
