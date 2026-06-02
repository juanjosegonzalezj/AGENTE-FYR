# 🎾 Find Your Rival – AI-Powered Sports Complex Platform v2.0

Production-ready multi-tenant SaaS for sports complex management.
AI assistant (Claude) + Google Calendar + WhatsApp + Supabase.

---

## Architecture

```
┌─────────────────────────────────────────────────────────┐
│  Next.js 15 Admin Dashboard  (web/)      :3000          │
│  Dashboard · Courts · Reservations · Players            │
│  Analytics · AI Chat · Settings                         │
└─────────────────┬───────────────────────────────────────┘
                  │ HTTP (X-Tenant-ID header)
┌─────────────────▼───────────────────────────────────────┐
│  Node.js / TypeScript API  (server.ts)   :3001          │
│  Express · Helmet · CORS · Rate Limiting                │
│  Tenant Middleware · Auth (Supabase JWT)                │
│  REST: /api/v1/courts|reservations|players|ai|calendar  │
└───────┬──────────────┬──────────────┬───────────────────┘
        │              │              │
   ┌────▼────┐   ┌─────▼─────┐  ┌───▼──────────┐
   │ Claude  │   │  Google   │  │  WhatsApp    │
   │ Sonnet  │   │ Calendar  │  │  Web.js      │
   │ (Tools) │   │  API v3   │  │  (QR Auth)   │
   └────┬────┘   └─────┬─────┘  └───┬──────────┘
        └──────────────┴─────────────┘
                        │
┌───────────────────────▼─────────────────────────────────┐
│  Supabase PostgreSQL                                     │
│  sports_complexes · courts · players · reservations     │
│  matches · conversations · messages · court_calendars   │
│  Row-Level Security (multi-tenant isolation)            │
└─────────────────────────────────────────────────────────┘
```

---

## Quick Start

### 1. Install backend dependencies

```bash
npm install
```

### 2. Install frontend dependencies

```bash
cd web && npm install && cd ..
```

### 3. Configure environment

```bash
cp .env.example .env
# Edit .env: fill SUPABASE_URL, SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY,
#            ANTHROPIC_API_KEY, GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET
```

```bash
cp web/.env.local.example web/.env.local
# Edit web/.env.local: fill NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY
```

### 4. Run Supabase migrations

In Supabase Dashboard → SQL Editor, run in order:
1. `supabase/migrations/001_initial_schema.sql`
2. `supabase/migrations/002_rls_policies.sql`
3. `supabase/migrations/003_indexes.sql`
4. `supabase/migrations/004_functions.sql`
5. `supabase/seed.sql` ← optional demo data

### 5. Start development

```bash
# Terminal 1 — Backend API
npm run dev

# Terminal 2 — Admin Dashboard
cd web && npm run dev
```

- **Admin Dashboard**: http://localhost:3000
- **API**: http://localhost:3001
- **Health Check**: http://localhost:3001/health
- **WhatsApp QR**: http://localhost:3001/webhooks/whatsapp/qr

---

## AI Agent

Claude Sonnet with 8 real-data tools. **Never invents data.**

| Tool | What it does |
|------|-------------|
| `get_available_courts` | Reads Google Calendar freebusy API |
| `create_booking` | Creates DB reservation + Calendar event |
| `cancel_booking` | Cancels DB record + deletes Calendar event |
| `reschedule_booking` | Moves slot in DB + Calendar |
| `find_opponents` | ELO-based matchmaking from players DB |
| `get_player_profile` | Player stats and skill info |
| `get_complex_information` | Courts, sports, pricing |
| `get_reservation_details` | Full reservation info |

**Example conversations that work:**
```
"Quiero reservar una pista de pádel mañana a las 7"
"Busca un rival de tenis para el sábado por la tarde"
"Cancela mi reserva del jueves"
"¿Qué pistas están disponibles esta noche?"
"¿Cuánto cuesta una hora de tenis?"
```

---

## API Reference

All routes require `X-Tenant-ID: <complex-uuid>` header.

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/health` | Health check |
| GET | `/api/v1/courts` | List courts (`?sport=padel`) |
| POST | `/api/v1/courts` | Create court |
| GET | `/api/v1/courts/:id/availability` | Real-time slots (`?date=YYYY-MM-DD`) |
| GET | `/api/v1/reservations` | List reservations |
| POST | `/api/v1/reservations` | Create reservation |
| PATCH | `/api/v1/reservations/:id` | Modify reservation |
| DELETE | `/api/v1/reservations/:id` | Cancel reservation |
| GET | `/api/v1/players` | List players |
| POST | `/api/v1/players` | Create player |
| POST | `/api/v1/ai/chat` | **AI assistant chat** |
| GET | `/api/v1/analytics/summary` | Dashboard KPIs |
| GET | `/api/v1/analytics/occupancy` | Court occupancy |
| GET | `/api/v1/analytics/revenue` | Revenue by day |
| GET | `/api/v1/calendar/connect` | Start Google OAuth |
| POST | `/api/v1/calendar/link` | Link calendar to court |
| GET | `/webhooks/whatsapp/qr` | WhatsApp QR code |
| GET | `/webhooks/whatsapp/status` | WhatsApp connection status |

---

## Environment Variables

### Backend (.env)

| Variable | Required | Description |
|----------|----------|-------------|
| `SUPABASE_URL` | ✅ | Your Supabase project URL |
| `SUPABASE_ANON_KEY` | ✅ | Supabase anon/public key |
| `SUPABASE_SERVICE_ROLE_KEY` | ✅ | Supabase service role key |
| `ANTHROPIC_API_KEY` | ✅ | Claude API key (`sk-ant-...`) |
| `GOOGLE_CLIENT_ID` | ✅ | Google OAuth 2.0 Client ID |
| `GOOGLE_CLIENT_SECRET` | ✅ | Google OAuth 2.0 Client Secret |
| `GOOGLE_REDIRECT_URI` | ✅ | OAuth callback URL |
| `ENCRYPTION_KEY` | ✅ | 32+ char random string |
| `PORT` | ❌ | Default: 3001 |

### Frontend (web/.env.local)

| Variable | Required | Description |
|----------|----------|-------------|
| `NEXT_PUBLIC_SUPABASE_URL` | ✅ | Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | ✅ | Supabase anon key |
| `NEXT_PUBLIC_API_URL` | ❌ | Backend URL (default: localhost:3001) |

---

## Google Calendar Setup

1. [Google Cloud Console](https://console.cloud.google.com) → New project
2. Enable **Google Calendar API**
3. Credentials → OAuth 2.0 Client ID → Web application
4. Authorized redirect URI: `http://localhost:3001/api/v1/calendar/oauth/callback`
5. Copy Client ID & Secret into `.env`
6. Admin Dashboard → Settings → Connect Google Calendar
7. Assign each court its own calendar

---

## WhatsApp Setup

### Recommended MVP path: Twilio WhatsApp

Use Twilio first if you want the fastest official MVP. Twilio gives you a WhatsApp Sandbox for testing before your production WhatsApp sender is approved.

1. Create or open your Twilio account.
2. Go to Messaging -> Try it out -> Send a WhatsApp message.
3. Copy your Account SID, Auth Token, and sandbox WhatsApp sender number.
4. Set these variables in `.env`:

```bash
WHATSAPP_PROVIDER=twilio
TWILIO_ACCOUNT_SID=ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
TWILIO_AUTH_TOKEN=your_twilio_auth_token
TWILIO_WHATSAPP_FROM=+14155238886
APP_URL=https://your-public-backend-url
```

5. In Twilio Sandbox settings, set "When a message comes in" to:

```text
https://your-public-backend-url/webhooks/whatsapp/twilio
```

6. In Supabase, make sure your `sports_complexes.whatsapp_number` matches `TWILIO_WHATSAPP_FROM`, including the `+` and country code.

### Local QR fallback: whatsapp-web.js

1. Start the backend: `npm run dev`
2. Visit: http://localhost:3001/webhooks/whatsapp/qr
3. Scan the QR with WhatsApp on your phone
4. The AI will now respond to all incoming messages automatically
5. Session saved to `whatsapp-session/` — no re-scan needed after restart

---

## Multi-Tenant Design

- Every DB table has `complex_id` FK
- PostgreSQL RLS enforces tenant isolation at the database level
- Tenant resolved via `X-Tenant-ID` header or `X-Tenant-Slug`
- WhatsApp: tenant resolved by matching business phone number
- No data leakage between sports complexes possible

---

## Project Structure

```
find-your-rival/
├── server.ts                    # Express entry point
├── src/
│   ├── config/index.ts          # Env validation (Zod)
│   ├── types/index.ts           # All TypeScript types
│   ├── utils/logger.ts          # Winston logger
│   ├── db/
│   │   ├── client.ts            # Supabase clients
│   │   └── queries/             # Typed DB queries
│   ├── ai/
│   │   ├── agent.ts             # Claude orchestrator
│   │   ├── prompts.ts           # System prompts
│   │   └── tools/               # 8 tool implementations
│   ├── integrations/
│   │   ├── google-calendar/     # OAuth, events, availability
│   │   └── whatsapp/            # Client, handler, sender
│   ├── middleware/              # Auth, tenant, rate-limit
│   └── routes/                  # API v1 + webhooks
├── supabase/
│   ├── migrations/              # SQL migrations 001-004
│   └── seed.sql                 # Demo data
└── web/                         # Next.js 15 admin dashboard
    ├── app/
    │   ├── (auth)/login/
    │   └── (dashboard)/
    │       ├── page.tsx         # Overview
    │       ├── courts/
    │       ├── reservations/
    │       ├── players/
    │       ├── analytics/
    │       ├── ai/              # AI Chat UI
    │       └── settings/
    ├── components/
    └── lib/
```

---

## Deployment

### Backend → Railway / Render

```bash
npm run build && npm start
```

Set all environment variables in the dashboard.

### Frontend → Vercel

```bash
cd web && vercel --prod
```

Point `NEXT_PUBLIC_API_URL` to your Railway/Render backend URL.

---

*Built with Claude Sonnet · Supabase · Google Calendar · WhatsApp*
