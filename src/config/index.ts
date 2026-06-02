import { z } from 'zod';
import dotenv from 'dotenv';

dotenv.config();

const configSchema = z.object({
  PORT: z.string().default('3001').transform(Number),
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),

  // Supabase
  SUPABASE_URL: z.string().url('SUPABASE_URL must be a valid URL'),
  SUPABASE_ANON_KEY: z.string().min(10, 'SUPABASE_ANON_KEY is required'),
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(10, 'SUPABASE_SERVICE_ROLE_KEY is required'),

  // Anthropic
  ANTHROPIC_API_KEY: z.string().startsWith('sk-ant-', 'ANTHROPIC_API_KEY must start with sk-ant-'),

  // Google Calendar
  GOOGLE_CLIENT_ID: z.string().min(1, 'GOOGLE_CLIENT_ID is required'),
  GOOGLE_CLIENT_SECRET: z.string().min(1, 'GOOGLE_CLIENT_SECRET is required'),
  GOOGLE_REDIRECT_URI: z.string().url('GOOGLE_REDIRECT_URI must be a valid URL'),

  // WhatsApp
  WHATSAPP_PROVIDER: z.enum(['webjs', 'twilio']).default('webjs'),
  WHATSAPP_SESSION_PATH: z.string().default('./whatsapp-session'),
  TWILIO_ACCOUNT_SID: z.string().optional(),
  TWILIO_AUTH_TOKEN: z.string().optional(),
  TWILIO_WHATSAPP_FROM: z.string().optional(),

  // Security
  ENCRYPTION_KEY: z.string().min(32, 'ENCRYPTION_KEY must be at least 32 characters'),

  // App
  APP_URL: z.string().url().default('http://localhost:3001'),
  FRONTEND_URL: z.string().url().default('http://localhost:3000'),

  // FYR – Google Calendar (cancha única)
  GOOGLE_API_KEY: z.string().default(''),
  GOOGLE_CALENDAR_ID: z.string().default(''),
  GOOGLE_REFRESH_TOKEN: z.string().default(''),

  // FYR – Datos del complejo aliado
  COMPLEX_NOMBRE: z.string().default('Find Your Rival'),
  COMPLEX_CIUDAD: z.string().default('Pereira, Colombia'),
  COMPLEX_WHATSAPP: z.string().default(''),
  COMPLEX_CANCHA_FUTBOL: z.string().default('Cancha Fútbol'),
  COMPLEX_CANCHA_PADEL: z.string().default('Pista Pádel'),
  COMPLEX_VALOR_FUTBOL: z.string().default('80000'),   // COP por partido
  COMPLEX_VALOR_PADEL: z.string().default('60000'),    // COP por partido
});

// In development, every sensitive key is optional — server boots with warnings
const devSchema = z.object({
  PORT: z.string().default('3001').transform(Number),
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  SUPABASE_URL: z.string().url().optional().default('http://placeholder.supabase.co'),
  SUPABASE_ANON_KEY: z.string().optional().default('placeholder'),
  SUPABASE_SERVICE_ROLE_KEY: z.string().optional().default('placeholder'),
  ANTHROPIC_API_KEY: z.string().optional().default('placeholder'),
  GOOGLE_CLIENT_ID: z.string().optional().default('placeholder'),
  GOOGLE_CLIENT_SECRET: z.string().optional().default('placeholder'),
  GOOGLE_REDIRECT_URI: z.string().optional().default('http://localhost:3001/api/v1/calendar/oauth/callback'),
  WHATSAPP_PROVIDER: z.enum(['webjs', 'twilio']).default('webjs'),
  WHATSAPP_SESSION_PATH: z.string().default('./whatsapp-session'),
  TWILIO_ACCOUNT_SID: z.string().optional(),
  TWILIO_AUTH_TOKEN: z.string().optional(),
  TWILIO_WHATSAPP_FROM: z.string().optional(),
  ENCRYPTION_KEY: z.string().optional().default('00000000000000000000000000000000'),
  APP_URL: z.string().default('http://localhost:3001'),
  FRONTEND_URL: z.string().default('http://localhost:3000'),
  GOOGLE_API_KEY: z.string().optional().default(''),
  GOOGLE_CALENDAR_ID: z.string().optional().default(''),
  GOOGLE_REFRESH_TOKEN: z.string().optional().default(''),
  COMPLEX_NOMBRE: z.string().optional().default('Find Your Rival'),
  COMPLEX_CIUDAD: z.string().optional().default('Pereira, Colombia'),
  COMPLEX_WHATSAPP: z.string().optional().default(''),
  COMPLEX_CANCHA_FUTBOL: z.string().optional().default('Cancha Fútbol'),
  COMPLEX_CANCHA_PADEL: z.string().optional().default('Pista Pádel'),
  COMPLEX_VALOR_FUTBOL: z.string().optional().default('80000'),
  COMPLEX_VALOR_PADEL: z.string().optional().default('60000'),
});

function loadConfig() {
  if (process.env.NODE_ENV === 'production') {
    const result = configSchema.safeParse(process.env);
    if (!result.success) {
      const missing = result.error.errors.map(e => `  ${e.path.join('.')}: ${e.message}`).join('\n');
      console.error(`\n❌ Environment configuration errors:\n${missing}\n`);
      process.exit(1);
    }
    return result.data;
  }

  // Development — use defaults for missing/invalid keys, warn but continue
  const result = devSchema.parse({
    ...process.env,
    // Strip placeholder values so defaults kick in
    ANTHROPIC_API_KEY: process.env.ANTHROPIC_API_KEY?.startsWith('sk-ant-')
      ? process.env.ANTHROPIC_API_KEY : undefined,
    SUPABASE_SERVICE_ROLE_KEY: (process.env.SUPABASE_SERVICE_ROLE_KEY?.startsWith('eyJ') || process.env.SUPABASE_SERVICE_ROLE_KEY?.startsWith('sb_secret_'))
      ? process.env.SUPABASE_SERVICE_ROLE_KEY : undefined,
    GOOGLE_CLIENT_ID: process.env.GOOGLE_CLIENT_ID?.includes('.apps.googleusercontent.com')
      ? process.env.GOOGLE_CLIENT_ID : undefined,
    ENCRYPTION_KEY: (process.env.ENCRYPTION_KEY?.length ?? 0) >= 32
      ? process.env.ENCRYPTION_KEY : undefined,
  });

  // Warn about missing keys
  const missing: string[] = [];
  if (!process.env.ANTHROPIC_API_KEY?.startsWith('sk-ant-')) missing.push('ANTHROPIC_API_KEY');
  const srk = process.env.SUPABASE_SERVICE_ROLE_KEY ?? '';
  if (!srk.startsWith('eyJ') && !srk.startsWith('sb_secret_')) missing.push('SUPABASE_SERVICE_ROLE_KEY');
  if (missing.length) {
    console.warn(`\n⚠️  Missing API keys (some features won't work): ${missing.join(', ')}\n`);
  }

  return result as z.infer<typeof configSchema>;
}

export const config = loadConfig();

export const isDev = config.NODE_ENV === 'development';
export const isProd = config.NODE_ENV === 'production';
