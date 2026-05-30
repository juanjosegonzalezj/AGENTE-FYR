// ─────────────────────────────────────────────────────────────────────────────
// Find Your Rival – Shared TypeScript Types
// ─────────────────────────────────────────────────────────────────────────────

// ── Sports ───────────────────────────────────────────────────────────────────

export type Sport = 'tennis' | 'padel' | 'soccer' | 'basketball' | 'volleyball' | 'other';
export type SkillLevel = 'beginner' | 'intermediate' | 'advanced' | 'professional';
export type Gender = 'male' | 'female' | 'non_binary' | 'any';

// ── Sports Complex (Tenant) ───────────────────────────────────────────────────

export interface SportsComplex {
  id: string;
  name: string;
  slug: string;
  email: string;
  phone: string | null;
  address: string | null;
  city: string | null;
  country: string;
  timezone: string;
  plan: 'starter' | 'professional' | 'enterprise';
  plan_status: 'trial' | 'active' | 'past_due' | 'cancelled';
  whatsapp_number: string | null;
  settings: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

// ── Courts ────────────────────────────────────────────────────────────────────

export interface Court {
  id: string;
  complex_id: string;
  name: string;
  sport: Sport;
  surface: string | null;
  indoor: boolean;
  capacity: number;
  hourly_rate: number | null;
  currency: string;
  google_calendar_id: string | null;
  is_active: boolean;
  amenities: string[];
  created_at: string;
  updated_at: string;
}

export interface CourtCalendar {
  id: string;
  complex_id: string;
  court_id: string;
  google_calendar_id: string;
  google_account_email: string;
  access_token: string | null;
  refresh_token: string | null;
  token_expires_at: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

// ── Players ───────────────────────────────────────────────────────────────────

export interface Player {
  id: string;
  complex_id: string;
  user_id: string | null;
  full_name: string;
  email: string | null;
  phone: string | null;
  whatsapp_id: string | null;
  sport: Sport;
  skill_level: SkillLevel;
  skill_score: number;
  age: number | null;
  gender: Gender | null;
  preferred_times: PreferredTime[];
  is_active: boolean;
  is_looking_for_match: boolean;
  stats: PlayerStats;
  created_at: string;
  updated_at: string;
}

export interface PreferredTime {
  day: 'monday' | 'tuesday' | 'wednesday' | 'thursday' | 'friday' | 'saturday' | 'sunday';
  start: string; // HH:MM
  end: string;   // HH:MM
}

export interface PlayerStats {
  wins: number;
  losses: number;
  matches: number;
}

// ── Customers ─────────────────────────────────────────────────────────────────

export interface Customer {
  id: string;
  complex_id: string;
  full_name: string;
  email: string | null;
  phone: string | null;
  notes: string | null;
  created_at: string;
}

// ── Reservations ──────────────────────────────────────────────────────────────

export type ReservationStatus = 'pending' | 'confirmed' | 'cancelled' | 'no_show';

export interface Reservation {
  id: string;
  complex_id: string;
  court_id: string;
  player_id: string | null;
  customer_id: string | null;
  google_event_id: string | null;
  title: string | null;
  sport: Sport;
  starts_at: string;
  ends_at: string;
  duration_minutes: number;
  status: ReservationStatus;
  player_count: number;
  total_price: number | null;
  currency: string;
  notes: string | null;
  cancelled_at: string | null;
  reminder_sent: boolean;
  metadata: Record<string, unknown>;
  created_at: string;
  updated_at: string;
  // Joined fields
  court?: Court;
  player?: Player;
}

// ── Availability ──────────────────────────────────────────────────────────────

export interface AvailabilitySlot {
  start: string;   // ISO datetime
  end: string;     // ISO datetime
  available: boolean;
  duration_minutes: number;
}

export interface CourtAvailability {
  court_id: string;
  court_name: string;
  sport: Sport;
  date: string;
  slots: AvailabilitySlot[];
}

// ── Matches ───────────────────────────────────────────────────────────────────

export type MatchStatus = 'scheduled' | 'in_progress' | 'completed' | 'cancelled';

export interface Match {
  id: string;
  complex_id: string;
  reservation_id: string | null;
  sport: Sport;
  player1_id: string | null;
  player2_id: string | null;
  winner_id: string | null;
  score: string | null;
  status: MatchStatus;
  played_at: string | null;
  notes: string | null;
  created_at: string;
}

// ── Messages (AI Conversations) ───────────────────────────────────────────────

export type MessageChannel = 'whatsapp' | 'web' | 'api';
export type MessageRole = 'user' | 'assistant';

export interface Message {
  id: string;
  complex_id: string | null;
  player_id: string | null;
  channel: MessageChannel;
  channel_user_id: string | null;
  conversation_id: string;
  role: MessageRole;
  content: string;
  tool_calls: unknown | null;
  tool_results: unknown | null;
  metadata: Record<string, unknown>;
  created_at: string;
}

export interface Conversation {
  id: string;
  complex_id: string | null;
  player_id: string | null;
  channel: MessageChannel;
  channel_user_id: string | null;
  messages: AnthropicMessage[];
  last_message_at: string | null;
}

// ── Anthropic / AI Types ──────────────────────────────────────────────────────

export interface AnthropicMessage {
  role: 'user' | 'assistant';
  content: string | AnthropicContentBlock[];
}

export interface AnthropicContentBlock {
  type: 'text' | 'tool_use' | 'tool_result';
  text?: string;
  id?: string;
  name?: string;
  input?: Record<string, unknown>;
  tool_use_id?: string;
  content?: string;
}

// ── Matchmaking ───────────────────────────────────────────────────────────────

export interface MatchmakingCandidate {
  player: Player;
  score: number;          // 0-100 compatibility score
  reasons: string[];      // Human-readable explanations
}

export interface MatchmakingRequest {
  complex_id: string;
  requester_id: string;
  sport: Sport;
  skill_min?: number;
  skill_max?: number;
  preferred_date: string;
  time_start: string;
  time_end: string;
  gender_pref?: Gender;
  age_min?: number;
  age_max?: number;
}

// ── API Response Shapes ───────────────────────────────────────────────────────

export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}

export interface PaginatedResponse<T> extends ApiResponse<T[]> {
  total: number;
  page: number;
  limit: number;
}

// ── Express Request Augmentation ──────────────────────────────────────────────

declare global {
  namespace Express {
    interface Request {
      tenantId?: string;
      complex?: SportsComplex;
      userId?: string;
    }
  }
}
