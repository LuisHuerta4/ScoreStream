# Score**Stream**

**Real-time football scores and live commentary.**

![React](https://img.shields.io/badge/React-19-61DAFB?style=flat-square&logo=react&logoColor=white)
![TypeScript](https://img.shields.io/badge/TypeScript-5.9-3178C6?style=flat-square&logo=typescript&logoColor=white)
![Vite](https://img.shields.io/badge/Vite-7-646CFF?style=flat-square&logo=vite&logoColor=white)
![Tailwind CSS](https://img.shields.io/badge/Tailwind_CSS-4-06B6D4?style=flat-square&logo=tailwindcss&logoColor=white)
![Express](https://img.shields.io/badge/Express-5-000000?style=flat-square&logo=express&logoColor=white)
![Node.js](https://img.shields.io/badge/Node.js-ESM-339933?style=flat-square&logo=nodedotjs&logoColor=white)
![PostgreSQL](https://img.shields.io/badge/PostgreSQL-4169E1?style=flat-square&logo=postgresql&logoColor=white)
![Drizzle](https://img.shields.io/badge/Drizzle_ORM-0.45-C5F74F?style=flat-square&logo=drizzle&logoColor=black)
![WebSocket](https://img.shields.io/badge/WebSocket-ws_8-010101?style=flat-square&logo=socketdotio&logoColor=white)
![Zod](https://img.shields.io/badge/Zod-4-3E67B1?style=flat-square&logo=zod&logoColor=white)
![Arcjet](https://img.shields.io/badge/Arcjet-Security-6C2BD9?style=flat-square)
![Render](https://img.shields.io/badge/Render-Deploy-46E3B7?style=flat-square&logo=render&logoColor=white)

ScoreStream is a full-stack live sports dashboard that streams football match data from top European leagues in real time. It polls the [API-Football](https://www.api-football.com/) REST API, ingests fixtures, events, and statistics into a PostgreSQL database, and pushes updates to every connected client over WebSockets — all rendered in a bold neo-brutalist UI.

---

## Screenshots

### Dashboard
The main view showing fixtures across all tracked leagues with live score updates and status filtering.

![Dashboard](frontend/public/screen-home.png)

### Live Commentary
Real-time match commentary with typed event chips (goals, cards, substitutions, VAR) streamed via WebSocket.

![Commentary](frontend/public/screen-commentary.png)

### Match Statistics
Detailed head-to-head statistics including possession, shots, corners, fouls, and pass accuracy.

![Statistics](frontend/public/screen-stats.png)

---

## Highlights

- **True real-time** — WebSocket-powered push architecture. Scores, commentary, and match stats update live across all connected clients without polling or page refreshes.
- **Autonomous data pipeline** — A background sync service polls API-Football every 20 minutes, upserts fixtures, ingests match events (goals, cards, subs, VAR), and fetches per-match statistics automatically.
- **7 major leagues tracked** — Premier League, La Liga, Bundesliga, Serie A, Ligue 1, Champions League, and Europa League.
- **Commentary engine** — Structured event ingestion maps API-Football events into typed commentary rows (goals, yellow/red cards, substitutions, penalties, VAR decisions) with deduplication on restart.
- **Production-grade security** — Arcjet integration provides rate limiting, bot detection, and DDoS protection on both HTTP and WebSocket upgrade paths.
- **Zero-dependency state management** — All state lives in React hooks and a singleton WebSocket client. No Redux, no Zustand — just React.
- **Responsive neo-brutalist design** — Thick borders, offset shadows, electric yellow accents, maximum font weight. Mobile-first with adaptive grid layouts and a slide-in commentary panel.

---

## Tech Stack

### Backend

| Technology | Purpose |
|---|---|
| **Node.js (ESM)** | Runtime |
| **Express 5** | HTTP routing and middleware |
| **ws** | WebSocket server for real-time fan-out |
| **PostgreSQL** | Persistent data store |
| **Drizzle ORM** | Schema-first ORM with migration management |
| **Zod 4** | Request validation |
| **Arcjet** | Rate limiting, bot detection, DDoS protection |

### Frontend

| Technology | Purpose |
|---|---|
| **React 19** | UI framework |
| **TypeScript 5.9** | Static typing (strict mode) |
| **Vite 7** | Dev server, HMR, production bundler |
| **Tailwind CSS 4** | Utility-first styling |

### Infrastructure

| Technology | Purpose |
|---|---|
| **Render** | Deployment platform (single service) |
| **Neon / PostgreSQL** | Managed database |
| **API-Football** | External data source |

---

## Architecture

```
                        ┌─────────────────────┐
                        │    API-Football      │
                        │  (external data)     │
                        └─────────┬───────────┘
                                  │ poll every 20 min
                                  ▼
┌──────────────┐       ┌─────────────────────────────────┐
│              │  HTTP  │           Express 5              │
│   React 19   │◄──────►│  ├─ REST API (/matches, /commentary)
│   SPA        │       │  ├─ Zod validation              │
│              │  WS   │  ├─ Arcjet security              │
│  (Vite +     │◄═════►│  └─ Drizzle ORM                 │
│   Tailwind)  │       │                                   │
└──────────────┘       │  Background Services:             │
                       │  ├─ sportSync  (fetch + ingest)   │
                       │  └─ cleanupJob (purge > 48h)      │
                       └──────────────┬────────────────────┘
                                      │
                                      ▼
                              ┌──────────────┐
                              │  PostgreSQL   │
                              │  (Drizzle)    │
                              └──────────────┘
```

### Real-Time Data Flow

1. **sportSync** polls API-Football for today's fixtures across 7 leagues
2. New/updated matches are upserted into PostgreSQL via Drizzle
3. On score or status changes, match events and statistics are fetched and ingested
4. WebSocket broadcasts push `match_created`, `match_updated`, and `commentary` events to connected clients
5. The React frontend receives updates and re-renders in place — no page refresh

### WebSocket Protocol

| Event | Direction | Target | Description |
|---|---|---|---|
| `welcome` | Server → Client | Sender | Sent on connection |
| `match_created` | Server → Client | All | New fixture detected |
| `match_updated` | Server → Client | All | Score/stats changed |
| `commentary` | Server → Client | Subscribers | New match event |
| `subscribe` | Client → Server | — | Opt in to match commentary |
| `unsubscribe` | Client → Server | — | Opt out of match commentary |

---

## Project Structure

```
ScoreStream/
├── backend/
│   └── src/
│       ├── index.js               # Server bootstrap
│       ├── arcjet.js              # Security policies
│       ├── db/
│       │   ├── db.js              # Postgres + Drizzle instance
│       │   └── schema.js          # Table definitions
│       ├── routes/
│       │   ├── matches.js         # GET/POST /matches
│       │   └── commentary.js      # GET/POST /matches/:id/commentary
│       ├── validation/            # Zod schemas
│       ├── services/
│       │   ├── sportSync.js       # API-Football polling + ingestion
│       │   └── cleanupJob.js      # Stale data cleanup (48h)
│       └── ws/
│           └── server.js          # WebSocket server + subscriptions
├── frontend/
│   └── src/
│       ├── App.tsx                # Root layout, tabs, grid
│       ├── lib/
│       │   ├── api.ts             # REST client (fetch wrapper)
│       │   └── ws.ts              # WebSocket singleton client
│       ├── hooks/
│       │   ├── useMatches.ts      # Match list + WS sync
│       │   └── useMatchDetail.ts  # Commentary + WS subscriptions
│       └── components/
│           ├── MatchCard.tsx       # Fixture card
│           ├── CommentaryPanel.tsx # Side drawer (commentary + stats)
│           ├── CommentaryItem.tsx  # Event row with typed chips
│           └── StatusBadge.tsx     # Live / Upcoming / FT indicator
├── render.yaml                    # Render deployment config
└── README.md
```

---

## Getting Started

### Prerequisites

- **Node.js** 20+
- **PostgreSQL** database (local or hosted — [Neon](https://neon.tech/) works great)
- **API-Football** API key ([free tier](https://www.api-football.com/pricing) — 100 requests/day)
- **Arcjet** API key (optional — security middleware is skipped if absent)

### Setup

```bash
# Clone the repository
git clone https://github.com/<your-username>/ScoreStream.git
cd ScoreStream

# Install dependencies
npm install
cd backend && npm install && cd ..
cd frontend && npm install && cd ..
```

### Environment Variables

Create `backend/.env`:

```env
DATABASE_URL=postgresql://user:password@host:5432/scorestream
API_FOOTBALL_KEY=your_api_football_key
ARCJET_KEY=your_arcjet_key          # optional

# Optional
PORT=8000                           # default: 8000
ARCJET_MODE=DRY_RUN                 # default: LIVE
```

### Database

```bash
cd backend
npm run db:generate    # Generate migrations from schema
npm run db:migrate     # Apply migrations
```

### Run

```bash
# Terminal 1 — Backend (port 8000)
cd backend
npm run dev

# Terminal 2 — Frontend (port 5173, proxies to backend)
cd frontend
npm run dev
```

Open **http://localhost:5173** — the sportSync service will immediately poll API-Football and populate matches.

---

## Key Design Decisions

| Decision | Rationale |
|---|---|
| **Single WebSocket connection** | The `WsClient` singleton ensures one connection regardless of mounted components. Handlers are registered/deregistered per hook. |
| **Subscription-scoped commentary** | Commentary events are only sent to clients that explicitly subscribe to a match, reducing bandwidth and keeping the protocol efficient. |
| **In-memory dedup with DB recovery** | `sportSync` tracks processed events in a `Set` to prevent duplicate commentary. On restart, it reconstructs state from the database. |
| **No state management library** | React hooks + a shared WS client are sufficient for the data flow. Avoids dependency bloat for a focused feature set. |
| **Derived match status** | Status (`scheduled` / `live` / `finished`) is derived from API-Football status codes, not timestamps — ensuring accuracy for delayed/cancelled matches. |
| **48-hour cleanup window** | Matches older than 48 hours are purged automatically, keeping the database lean while avoiding re-ingestion from the daily fixture pull. |

---

## API Reference

| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/matches?limit=50` | List matches from the last 2 days |
| `POST` | `/matches` | Create a match (admin/testing) |
| `GET` | `/matches/:id/commentary?limit=10` | Get commentary for a match |
| `POST` | `/matches/:id/commentary` | Add commentary to a match |
| `WS` | `/ws` | WebSocket connection for real-time updates |

---

## Deployment

ScoreStream is configured for **Render** via `render.yaml`. The single service builds the frontend into static assets and serves everything from the Node.js backend.

```bash
# Production build
cd frontend && npm run build    # outputs to frontend/dist/
cd backend && npm start          # serves API + static files
```