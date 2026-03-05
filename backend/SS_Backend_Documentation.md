# ScoreStream Backend Documentation

> **Version:** 2.0 — Updated to reflect API-Football integration, soccer-only focus, background services, match statistics, and all schema changes since v1.

---

## 1) Executive Summary

ScoreStream is a Node.js backend for a **live football scores and commentary platform**. It exposes a REST API for match and commentary operations, persists data in PostgreSQL via Drizzle ORM, and pushes real-time events over WebSockets.

The backend autonomously fetches live match data every 20 minutes from the **API-Football** REST API, ingests match events (goals, cards, substitutions, VAR) as structured commentary, and fetches per-match statistics (possession, shots, corners, etc.). It also runs a scheduled cleanup job that removes stale match data.

At a high level:

- **Express + HTTP server** powers REST endpoints.
- **WebSocket server (`ws`)** is attached to the same HTTP server for live fan-out.
- **PostgreSQL + Drizzle ORM** handles persistence and migration management.
- **Zod schemas** enforce request-level validation.
- **Arcjet** enforces rate limiting, bot detection, and DDoS protection.
- **`sportSync` service** polls API-Football, upserts matches, ingests events and statistics.
- **`cleanupJob` service** purges matches older than 48 hours on a 12-hour cycle.

---

## 2) Architecture Overview

### 2.1 System Context

```
External
  API-Football ──────────────────────────────────┐
  (football scores + events + stats)             │
                                                 ▼
Clients (web / mobile)                  [sportSync service]  [cleanupJob service]
  │                                              │                    │
  ├─ HTTP/JSON ──────────────▶ Express API       │                    │
  │   ├─ Validation (Zod)                        │                    │
  │   ├─ Security middleware (Arcjet HTTP)        │                    │
  │   └─ Data access (Drizzle ORM)               │                    │
  │                  │                           │                    │
  │                  ▼                           ▼                    ▼
  │              PostgreSQL ◀─────────────────────────────────────────┘
  │
  └─ WebSocket (/ws) ─────────▶ WS server
      ├─ Upgrade protection (Arcjet WS)
      ├─ Subscription management by matchId
      └─ Broadcast events:
            match_created  → all clients
            match_updated  → all clients
            commentary     → subscribed clients only
```

### 2.2 Runtime Composition

A single Node process runs:

- `express()` app and `http.createServer(app)`
- WebSocket server attached via `attachWebSocketServer(server)`
- `startSportSync({ broadcastMatchCreated, broadcastCommentary, broadcastMatchUpdated })` — background polling loop
- `startCleanupJob()` — background cleanup loop

REST routes publish domain events by calling broadcast functions stored in `app.locals`. Background services call the same broadcast functions directly, so all real-time delivery goes through a single WS layer.

---

## 3) Technology Stack

### 3.1 Core Platform

| Package | Version | Role |
|---|---|---|
| Node.js (ESM) | — | Runtime (`"type": "module"`) |
| Express | 5.x | HTTP routing and middleware |
| ws | 8.x | WebSocket server |

### 3.2 Data Layer

| Package | Version | Role |
|---|---|---|
| pg | 8.x | PostgreSQL driver |
| drizzle-orm | 0.45.x | Schema-first ORM and query builder |
| drizzle-kit | 0.31.x | Migration generation, execution, and studio |

### 3.3 Validation & Security

| Package | Version | Role |
|---|---|---|
| zod | 4.x | Input validation for HTTP params, queries, bodies |
| @arcjet/node | 1.x | Rate limiting, bot detection, DDoS protection |

### 3.4 Utility / Configuration

| Package | Role |
|---|---|
| dotenv | Environment variable loading |

---

## 4) Project Structure and Responsibilities

```
backend/
  src/
    index.js                  # App bootstrap + server wiring
    arcjet.js                 # Arcjet policy definitions + HTTP middleware
    db/
      db.js                   # Postgres pool + Drizzle instance
      schema.js               # matches/commentary schema + enum
    routes/
      matches.js              # GET/POST /matches
      commentary.js           # GET/POST /matches/:id/commentary
    validation/
      matches.js              # Zod schemas for match endpoints
      commentary.js           # Zod schemas for commentary endpoints
    utils/
      match.status.js         # Match lifecycle status derivation helpers
    ws/
      server.js               # WebSocket server + subscriptions + broadcasting
    services/
      sportSync.js            # API-Football polling + event/stats ingestion
      cleanupJob.js           # Scheduled deletion of matches older than 48 h
  drizzle/
    0000_*.sql                # Initial schema
    0001_*.sql                # external_id + league columns
    0002_*.sql                # Status enum update
    0003_*.sql                # ON DELETE CASCADE on commentary FK
    0004_*.sql                # stats JSONB column on matches
  drizzle.config.js           # Drizzle Kit configuration
  .env                        # Environment variables (not committed)
  package.json
```

---

## 5) Request Lifecycle and Flow

### 5.1 HTTP Path

1. Request enters Express app.
2. `express.json()` parses JSON payload.
3. Arcjet HTTP middleware runs (`securityMiddleware()`): shield checks, bot handling, sliding-window rate limiting.
4. Route-level Zod validation executes.
5. Route handler performs DB operation through Drizzle.
6. Successful mutation triggers real-time broadcast via `app.locals` callbacks.
7. JSON response returned to client.

### 5.2 WebSocket Path

1. Client upgrades to `/ws`.
2. Upgrade request passes Arcjet WS protection (5 attempts / 2 s / IP).
3. On connection:
   - Client receives `{ type: "welcome" }`.
   - Heartbeat (`ping/pong`) liveness tracking starts.
   - Client may `subscribe` / `unsubscribe` by `matchId`.
4. Background services and HTTP route mutations invoke broadcast functions.
5. WS layer emits events to all clients or to scoped match subscribers.

### 5.3 Background Sync Path (sportSync)

1. On startup and every **20 minutes**: `syncAll()` calls `GET /fixtures?date=TODAY` from API-Football (1 request).
2. Fixtures are filtered to the 7 tracked league IDs.
3. For each fixture, `processFixture()` upserts the match (INSERT or UPDATE).
4. If score or status changed, `processEvents()` fetches `GET /fixtures/events?fixture=ID` and inserts new commentary rows (deduplication via in-memory `Set`).
5. If the match is `live` or `finished`, `processStats()` fetches `GET /fixtures/statistics?fixture=ID`, stores stats as JSONB, and broadcasts `match_updated`.
6. WS broadcasts notify all connected clients.

### 5.4 Background Cleanup Path (cleanupJob)

1. On startup and every **12 hours**: queries matches where `start_time < 48 hours ago` (or `created_at < 48 hours ago` when no `start_time`).
2. Deletes qualifying match rows — commentary rows are deleted automatically via `ON DELETE CASCADE`.
3. Logs how many matches were removed.

---

## 6) Data Model

### 6.1 `matches`

Represents a football fixture, its live score, and aggregated statistics.

| Column | Type | Notes |
|---|---|---|
| `id` | serial PK | Auto-increment |
| `external_id` | text UNIQUE | API-Football fixture ID |
| `sport` | text NOT NULL | Always `'Soccer'` |
| `league` | text | League name (e.g. `'Premier League'`) |
| `home_team` | text NOT NULL | |
| `away_team` | text NOT NULL | |
| `status` | enum | `scheduled \| live \| finished` |
| `start_time` | timestamp | Fixture kickoff time |
| `end_time` | timestamp | Estimated end (start + 2 h) |
| `home_score` | integer | Default 0 |
| `away_score` | integer | Default 0 |
| `stats` | jsonb | Match statistics (see §6.3) |
| `created_at` | timestamp | Auto-generated |

### 6.2 `commentary`

Represents timeline events attached to a match (goals, cards, substitutions, etc.).

| Column | Type | Notes |
|---|---|---|
| `id` | serial PK | Auto-increment |
| `match_id` | integer FK | → `matches.id` ON DELETE CASCADE |
| `minute` | integer | Match minute of the event |
| `sequence` | integer | Ordering tie-breaker |
| `period` | text | e.g. `'1H'`, `'2H'` |
| `event_type` | text | See §6.4 for valid values |
| `actor` | text | Player name |
| `team` | text | Team name |
| `message` | text NOT NULL | Human-readable description |
| `metadata` | jsonb | Arbitrary extra data |
| `tags` | text[] | Array of tag strings |
| `created_at` | timestamp | Auto-generated |

### 6.3 `stats` JSONB Structure

Stored in `matches.stats`. Null for scheduled matches. Populated by `processStats()` and updated each poll cycle while the match is live.

```json
{
  "home": {
    "possession":   "55%",
    "shotsOnGoal":  5,
    "totalShots":   12,
    "corners":      5,
    "fouls":        10,
    "yellowCards":  2,
    "redCards":     0,
    "offsides":     2,
    "passAccuracy": "86%"
  },
  "away": {
    "possession":   "45%",
    "shotsOnGoal":  3,
    "totalShots":   8,
    "corners":      3,
    "fouls":        12,
    "yellowCards":  1,
    "redCards":     0,
    "offsides":     1,
    "passAccuracy": "79%"
  }
}
```

### 6.4 Commentary `event_type` Values

| Value | Description |
|---|---|
| `goal` | Regular goal with scorer name |
| `own_goal` | Own goal |
| `penalty` | Penalty goal |
| `yellow_card` | Yellow card |
| `red_card` | Red or second yellow card |
| `substitution` | Player substitution |
| `var` | VAR review decision |
| `status_change` | Kickoff, half time, full time messages |

### 6.5 Relational Notes

- One-to-many: `matches` → `commentary`.
- `ON DELETE CASCADE`: deleting a match automatically deletes all its commentary rows.
- `external_id` is unique and used for upsert logic in `sportSync.js` — prevents duplicate fixture rows across polling cycles.

---

## 7) API Surface

### 7.1 Health / Root

**`GET /`**

Returns a simple greeting string. Used for uptime checks.

---

### 7.2 Matches

**`GET /matches?limit=<n>`**

Returns matches from the **last 2 days**, ordered by `created_at DESC`.

- Default limit: `50`, hard cap: `100`.
- Filters: `start_time >= 2 days ago OR start_time IS NULL`.
- Response: `{ data: Match[] }`.

Each `Match` object includes the `stats` field (null if not yet populated).

---

**`POST /matches`**

Manually creates a match (used for testing/admin — production matches come from `sportSync`).

Required fields: `sport`, `homeTeam`, `awayTeam`, `startTime`, `endTime`
Optional fields: `homeScore`, `awayScore`
Invariant: `endTime > startTime`

Status is derived from current server time:
- Before `startTime` → `scheduled`
- Between `startTime` and `endTime` → `live`
- After `endTime` → `finished`

On success: persists match and broadcasts `match_created` event to all WS clients.
Response: `{ message: string, data: Match }` with HTTP 201.

---

### 7.3 Commentary

Mounted at `app.use('/matches/:id/commentary', commentaryRouter)`.

**`GET /matches/:id/commentary?limit=<n>`**

- Validates path param `id` (positive integer) and optional `limit`.
- Returns commentary for the match ordered by `created_at DESC`.
- Default limit: `10`, hard cap: `100`.
- Response: `{ data: Commentary[] }`.

---

**`POST /matches/:id/commentary`**

- Validates `id` plus commentary payload.
- Required: `message`
- Optional: `minute`, `eventType`, `actor`, `team`, `period`, `sequence`, `metadata`, `tags`
- Inserts commentary row linked to `match_id`.
- Broadcasts `commentary` WS event to all clients subscribed to that match.
- Response: `{ message: string, data: Commentary }` with HTTP 201.

---

## 8) WebSocket Protocol

**Endpoint:** `ws://<host>:<port>/ws`

Max payload size: 1 MB.

### 8.1 Server → Client Messages

| Message | Broadcast target | Description |
|---|---|---|
| `{ type: "welcome" }` | Connecting client only | Sent on connection established |
| `{ type: "subscribed", matchId }` | Connecting client only | Confirms subscription |
| `{ type: "unsubscribed", matchId }` | Connecting client only | Confirms unsubscription |
| `{ type: "match_created", data: Match }` | All clients | New fixture inserted by sportSync |
| `{ type: "match_updated", data: Match }` | All clients | Match stats updated (includes full match object) |
| `{ type: "commentary", data: Commentary }` | Match subscribers only | New commentary event for a specific match |
| `{ type: "error", message: string }` | Sending client only | Malformed message received |

### 8.2 Client → Server Messages

**Subscribe to a match:**
```json
{ "type": "subscribe", "matchId": 123 }
```

**Unsubscribe from a match:**
```json
{ "type": "unsubscribe", "matchId": 123 }
```

### 8.3 Subscription Model

- In-memory map: `matchId → Set<socket>`.
- Each socket stores its own `subscriptions` Set for cleanup on disconnect.
- Broadcast modes:
  - **Global** (`broadcastToAll`): `match_created`, `match_updated` — sent to every connected client regardless of subscriptions.
  - **Scoped** (`broadcastToMatch`): `commentary` — sent only to clients subscribed to that specific match.

### 8.4 Broadcast Functions

Three broadcast functions are exported from `ws/server.js` and consumed by both the route layer and background services:

| Function | Trigger | Target |
|---|---|---|
| `broadcastMatchCreated(match)` | New match inserted | All clients |
| `broadcastMatchUpdated(match)` | Stats updated | All clients |
| `broadcastCommentary(matchId, comment)` | New commentary inserted | Match subscribers |

### 8.5 Liveness

- Heartbeat ping sent every **30 seconds**.
- Socket terminated if no `pong` response received before next ping.
- Subscriptions cleaned up on disconnect.

---

## 9) Background Services

### 9.1 `sportSync.js` — API-Football Sync

**File:** `src/services/sportSync.js`
**Poll interval:** 20 minutes
**API budget:** ~72 fixture requests + ~20 event/stats requests = **~92 requests/day** (free tier cap: 100/day)

#### Tracked Leagues

| League | API-Football ID |
|---|---|
| Premier League | 39 |
| La Liga | 140 |
| Bundesliga | 78 |
| Serie A | 135 |
| Ligue 1 | 61 |
| UEFA Champions League | 2 |
| UEFA Europa League | 3 |

#### Status Mapping

| API-Football short codes | ScoreStream status |
|---|---|
| `1H`, `HT`, `2H`, `ET`, `P`, `BT`, `LIVE`, `INT` | `live` |
| `FT`, `AET`, `PEN`, `CANC`, `ABD`, `AWD`, `WO` | `finished` |
| All others | `scheduled` |

#### Key Functions

| Function | Description |
|---|---|
| `syncAll(broadcasts)` | Entry point: fetches `GET /fixtures?date=TODAY` (1 request), filters to tracked leagues, calls `processFixture` for each |
| `processFixture(fixture, broadcasts)` | Upserts match in DB; triggers event/stats fetch on score or status change |
| `processEvents(externalId, matchId, broadcastCommentary)` | Fetches `GET /fixtures/events?fixture=ID`, maps events to commentary rows, deduplicates |
| `processStats(externalId, matchId, broadcastMatchUpdated)` | Fetches `GET /fixtures/statistics?fixture=ID`, normalizes stats, stores as JSONB, broadcasts `match_updated` |
| `loadStateFromDb(externalId)` | Reconstructs in-memory sync state from DB after server restart (prevents duplicate events) |
| `mapEvent(event)` | Maps API-Football event object to a `commentary` row fields |
| `buildEventKey(minute, eventType, actor)` | Builds deduplication key: `${minute}_${eventType}_${actor_lowercase}` |

#### Sync State

`sportSync` maintains an in-memory `Map<externalId, state>` where each entry holds:

```js
{
  matchId: number,          // DB row ID
  status: string,           // last known status
  homeScore: number,
  awayScore: number,
  homeTeam: string,
  awayTeam: string,
  processedEventKeys: Set   // prevents duplicate commentary on restart
}
```

On server restart, `loadStateFromDb()` reconstructs `processedEventKeys` from existing commentary rows in the DB.

---

### 9.2 `cleanupJob.js` — Stale Match Deletion

**File:** `src/services/cleanupJob.js`
**Run interval:** Every 12 hours (also runs once at startup)

#### Logic

Deletes matches satisfying either condition:
- `start_time IS NOT NULL AND start_time < NOW() - 48 hours`
- `start_time IS NULL AND created_at < NOW() - 48 hours`

Commentary rows are deleted automatically via `ON DELETE CASCADE`.

This pairs with sportSync's `date=TODAY` filter — sportSync only ingests today's fixtures, so the 48-hour window prevents immediate re-insertion of just-deleted matches.

---

## 10) Validation Strategy

Validation is centralized in `src/validation/` and applied at the route level before any business logic runs.

| Schema | Location | Validates |
|---|---|---|
| `createMatchSchema` | `validation/matches.js` | `sport`, `homeTeam`, `awayTeam`, `startTime`, `endTime` (endTime > startTime), optional scores |
| `listMatchesQuerySchema` | `validation/matches.js` | `limit` (1–100, coerced) |
| `matchIdParamSchema` | `validation/matches.js` | `id` (positive integer, coerced) |
| `createCommentarySchema` | `validation/commentary.js` | `message` (required), optional event fields |
| `listCommentaryQuerySchema` | `validation/commentary.js` | `limit` (1–100, coerced) |

Benefits:
- Uniform `400` bad-request response structure with Zod issue details.
- Type coercion for query/path inputs (`z.coerce.number`).
- Business invariants encoded at the schema level.

---

## 11) Security and Abuse Prevention

Arcjet is configured separately for HTTP and WebSocket in `src/arcjet.js`.

| Policy | HTTP | WebSocket Upgrade |
|---|---|---|
| Shield (DDoS hardening) | ✓ | — |
| Bot detection | ✓ (allows search engines) | — |
| Rate limiting | 50 req / 10 s / IP | 5 attempts / 2 s / IP |

**Failure handling:**
- HTTP denied: `429` (rate-limited) or `403` (blocked).
- WS denied: status line written, socket destroyed.
- Arcjet errors: `503` (HTTP) or `500` (WS upgrade).

**Current mode:** Controlled by `ARCJET_MODE` env var. Set to `DRY_RUN` for logging-only (non-blocking) evaluation during development.

---

## 12) Configuration and Environment

### Required

| Variable | Description |
|---|---|
| `DATABASE_URL` | PostgreSQL connection string (Neon or any Postgres) |
| `API_FOOTBALL_KEY` | API-Football API key (free tier: 100 req/day) |
| `ARCJET_KEY` | Arcjet API key |

### Optional

| Variable | Default | Description |
|---|---|---|
| `PORT` | `8000` | HTTP/WS server port |
| `HOST` | `0.0.0.0` | Bind address |
| `ARCJET_MODE` | `LIVE` | Set to `DRY_RUN` for non-blocking policy evaluation |

**Note:** Startup will throw if `API_FOOTBALL_KEY` is missing or equals the placeholder `your_api_football_key_here`. Arcjet middleware is skipped gracefully if `ARCJET_KEY` is absent.

---

## 13) Database Migrations and Schema Management

Drizzle Kit workflow (`package.json` scripts):

```bash
npm run db:generate   # Generate SQL migration from schema changes
npm run db:migrate    # Apply pending migrations to the database
npm run db:studio     # Open Drizzle Studio (browser-based DB viewer)
```

`drizzle.config.js` points Drizzle Kit to:
- Schema source: `src/db/schema.js`
- Output folder: `drizzle/`
- Dialect: PostgreSQL

### Migration History

| File | Change |
|---|---|
| `0000_*.sql` | Initial `matches` and `commentary` tables, `match_status` enum |
| `0001_*.sql` | Added `external_id` (unique), `league` columns to `matches` |
| `0002_*.sql` | Status enum updates |
| `0003_*.sql` | `ON DELETE CASCADE` on `commentary.match_id` FK |
| `0004_*.sql` | Added `stats` JSONB column to `matches` |

---

## 14) Component-by-Component Deep Dive

### `src/index.js`
- Bootstraps Express + HTTP server.
- Registers `express.json()`, Arcjet middleware, and route handlers.
- Calls `attachWebSocketServer(server)` and stores all three broadcast functions in `app.locals`.
- Calls `startSportSync({ broadcastMatchCreated, broadcastCommentary, broadcastMatchUpdated })`.
- Calls `startCleanupJob()`.

### `src/arcjet.js`
- Constructs two Arcjet clients: `httpArcjet` (for Express middleware) and `wsArcjet` (for WS upgrade protection).
- Exports `securityMiddleware()` applied globally to HTTP routes.
- Exports `wsArcjet` used inside `ws/server.js` on upgrade events.

### `src/db/db.js`
- Loads environment config.
- Creates a shared `pg.Pool` and wraps it with Drizzle.
- Exported `db` instance is used throughout routes and services.

### `src/db/schema.js`
- Defines `matchStatusEnum`, `matches`, and `commentary` tables in code-first style.
- Canonical source used by Drizzle Kit for migration generation.
- Notable: `stats jsonb` column on `matches`, `ON DELETE CASCADE` on `commentary.match_id`.

### `src/routes/matches.js`
- `GET /matches`: queries last 2 days, applies limit.
- `POST /matches`: validates payload, derives status, inserts, broadcasts `match_created`.

### `src/routes/commentary.js`
- `GET /matches/:id/commentary`: validates id + limit, returns entries.
- `POST /matches/:id/commentary`: validates id + body, inserts, broadcasts `commentary` to match subscribers.

### `src/validation/matches.js` / `src/validation/commentary.js`
- Central contract layer for all incoming API traffic.
- Encodes type coercions and business invariants.

### `src/utils/match.status.js`
- `getMatchStatus(startTime, endTime)` — derives `scheduled | live | finished` from timestamps.
- Used by `POST /matches` when manually creating fixtures.

### `src/ws/server.js`
- Manages WS lifecycle: upgrade gate, connect/disconnect, heartbeat, subscription bookkeeping.
- `matchSubscribers`: `Map<matchId, Set<socket>>`.
- Each socket carries a `subscriptions: Set<matchId>` for cleanup on disconnect.
- Exports three broadcast functions: `broadcastMatchCreated`, `broadcastCommentary`, `broadcastMatchUpdated`.

### `src/services/sportSync.js`
- Polls `GET /fixtures?date=TODAY` every 20 minutes (1 request per cycle).
- Filters to 7 tracked league IDs in code — no per-league API calls.
- Maintains `syncState` Map in memory; reconstructs from DB on restart via `loadStateFromDb()`.
- Calls `processEvents()` and `processStats()` only when score or status changes.
- Broadcasts all three event types through the shared broadcast functions.

### `src/services/cleanupJob.js`
- Runs `runCleanup()` at startup and every 12 hours.
- Deletes matches older than 48 hours using Drizzle's `lt`, `or`, `and`, `isNull`, `isNotNull` operators.
- Commentary cascade deletes automatically via FK constraint.

---

## 15) Quick Start (Developer)

```bash
# 1. Set up environment
cp .env.example .env
# Fill in: DATABASE_URL, API_FOOTBALL_KEY, ARCJET_KEY

# 2. Install dependencies
npm install

# 3. Apply schema migrations
npm run db:generate && npm run db:migrate

# 4. Start development server (auto-restarts on file changes)
npm run dev

# 5. Connect a WebSocket client to receive live updates
# ws://localhost:8000/ws
# Send: { "type": "subscribe", "matchId": 1 }
```

Once running, `sportSync` will immediately poll API-Football and populate the database with today's fixtures from the 7 tracked leagues. The frontend can connect via the Vite dev proxy (`/api` → Express, `/ws` → WebSocket).
