# ScoreStream Frontend Documentation

> **Version:** 1.0 — Documents the React/TypeScript/Tailwind CSS frontend for the ScoreStream live football scores platform.

---

## 1) Executive Summary

The ScoreStream frontend is a **React 19 + TypeScript** single-page application built with Vite and styled with Tailwind CSS 4 in a **neo-brutalism** aesthetic. It delivers a live football scores dashboard with real-time updates — no page refresh required.

Key responsibilities:

- **Fetches** today's matches from the backend REST API on load.
- **Connects** to the backend WebSocket server and maintains a persistent, auto-reconnecting connection.
- **Receives** real-time pushes for new matches (`match_created`), score/stats updates (`match_updated`), and per-match commentary events (`commentary`).
- **Renders** a filterable card grid (Live / Upcoming / Finished / All tabs) and a fixed commentary/stats panel.
- **Subscribes** to individual match streams when the user opens a commentary panel, and cleans up subscriptions on close.

---

## 2) Architecture Overview

### 2.1 Data Flow

```
Backend REST API (/api/matches)
  │
  │  Initial load (fetch on mount)
  ▼
useMatches hook ──────────────────────────────▶ matches[] state
  ▲                                                    │
  │  WS: match_created  (prepend new match)            │
  │  WS: match_updated  (replace match in-place)       ▼
  │                                              App.tsx (filter + render)
Backend WebSocket (/ws)                               │
  │                                                    ▼
  │  WS: commentary     (prepend to feed)        MatchCard grid
  ▼                                                    │
useMatchDetail hook ──────────────────────────▶ commentary[] state
  ▲                                                    │
  │  subscribe/unsubscribe on panel open/close         ▼
  │                                            CommentaryPanel
  └──────────────────────────────────────────  (Commentary tab + Stats tab)
```

### 2.2 Runtime Structure

All state lives in React hooks and component state — there is no external state management library. The `wsClient` singleton is the single connection shared across all hooks; each hook registers and deregisters its own message handler via `onMessage` / `offMessage`.

---

## 3) Technology Stack

### 3.1 Core

| Package | Version | Role |
|---|---|---|
| React | 19.x | UI framework |
| react-dom | 19.x | DOM rendering |
| TypeScript | ~5.9.x | Static typing (strict mode) |
| Vite | 7.x | Dev server, HMR, production build |

### 3.2 Styling

| Package | Version | Role |
|---|---|---|
| Tailwind CSS | 4.x | Utility-first CSS |
| @tailwindcss/vite | 4.x | Vite-native Tailwind integration (no PostCSS config needed) |

### 3.3 Dev Tools

| Package | Role |
|---|---|
| @vitejs/plugin-react | Vite plugin for React JSX transform and Fast Refresh |
| eslint + typescript-eslint | Linting |
| eslint-plugin-react-hooks | Enforces hook rules |
| eslint-plugin-react-refresh | Guards against unsafe HMR patterns |

---

## 4) Project Structure and Responsibilities

```
frontend/
  src/
    main.tsx                  # React root mount point
    App.tsx                   # Root component — layout, tabs, grid, panel
    index.css                 # Global styles + Tailwind import + scrollbar
    types/
      index.ts                # Shared TypeScript interfaces and WS message types
    lib/
      api.ts                  # REST API client (fetchMatches, fetchCommentary)
      ws.ts                   # WebSocket singleton client (WsClient class)
    hooks/
      useMatches.ts           # Fetches all matches + handles WS match events
      useMatchDetail.ts       # Fetches commentary + handles WS commentary events
    components/
      MatchCard.tsx           # Match card with score display + commentary toggle
      CommentaryPanel.tsx     # Fixed right panel with Commentary and Stats tabs
      CommentaryItem.tsx      # Single commentary event row (chip + message)
      StatusBadge.tsx         # Live / Upcoming / FT status indicator chip
  index.html                  # Vite HTML entry point
  vite.config.ts              # Vite config + dev proxy rules
  tsconfig.app.json           # TypeScript compiler options
  tsconfig.json               # TypeScript project references root
  package.json
```

---

## 5) Type System

**File:** `src/types/index.ts`

All shared data shapes are defined here. These mirror the JSON shapes returned by the backend REST API and WebSocket messages.

### 5.1 `Match`

```typescript
interface Match {
  id: number;
  sport: string;             // Always 'Soccer' for API-Football sourced data
  league: string | null;     // e.g. 'Premier League'
  homeTeam: string;
  awayTeam: string;
  status: MatchStatus;       // 'scheduled' | 'live' | 'finished'
  homeScore: number;
  awayScore: number;
  stats: MatchStats | null;  // Null until first score/status change occurs
  startTime: string | null;
  endTime: string | null;
  createdAt: string;
}
```

### 5.2 `MatchStats` / `TeamStats`

Populated server-side from the API-Football `/fixtures/statistics` endpoint. Null for scheduled matches.

```typescript
interface TeamStats {
  possession:   string | null;  // e.g. "55%"
  shotsOnGoal:  number | null;
  totalShots:   number | null;
  corners:      number | null;
  fouls:        number | null;
  yellowCards:  number | null;
  redCards:     number | null;
  offsides:     number | null;
  passAccuracy: string | null;  // e.g. "86%"
}

interface MatchStats {
  home: TeamStats;
  away: TeamStats;
}
```

### 5.3 `Commentary`

```typescript
interface Commentary {
  id: number;
  matchId: number;
  minute: number | null;
  sequence: number | null;
  period: string | null;
  eventType: string | null;  // See event type table in §8.2
  actor: string | null;      // Player name
  team: string | null;
  message: string;
  metadata: Record<string, unknown> | null;
  tags: string[] | null;
  createdAt: string;
}
```

### 5.4 `WsMessage` (discriminated union)

```typescript
type WsMessage =
  | { type: 'welcome' }
  | { type: 'subscribed';   matchId: number }
  | { type: 'unsubscribed'; matchId: number }
  | { type: 'match_created';  data: Match }
  | { type: 'match_updated';  data: Match }
  | { type: 'commentary';     data: Commentary }
  | { type: 'error'; message: string };
```

---

## 6) Library Layer

### 6.1 REST API Client — `src/lib/api.ts`

Thin wrapper over the browser `fetch` API. All requests go to `/api`, which Vite proxies to the backend at `http://127.0.0.1:8000` in development (and to the deployed backend in production).

| Function | Endpoint | Returns |
|---|---|---|
| `fetchMatches()` | `GET /api/matches` | `Promise<Match[]>` |
| `fetchCommentary(matchId)` | `GET /api/matches/:id/commentary?limit=100` | `Promise<Commentary[]>` |

Both functions throw an `Error` with the HTTP status code on non-OK responses, which is caught and stored in hook error state.

---

### 6.2 WebSocket Client — `src/lib/ws.ts`

A **singleton** `WsClient` class instance exported as `wsClient`. Shared by all hooks — only one WebSocket connection is maintained regardless of how many components are mounted.

#### Key features

- **Auto-connects** on first call to `.connect()`. Skips if already connecting or open.
- **Protocol detection**: uses `wss://` on HTTPS pages, `ws://` on HTTP.
- **Exponential backoff reconnect**: starts at 1 second, doubles each failure, capped at 30 seconds. Resets to 1 second on successful connection.
- **Intentional close flag**: `disconnect()` sets `intentionalClose = true` so the `onclose` handler does not schedule a reconnect.
- **Multi-handler fan-out**: any number of message handlers can be registered via `onMessage(handler)` and removed with `offMessage(handler)`.

#### API

| Method | Description |
|---|---|
| `connect()` | Open connection (no-op if already open/connecting) |
| `disconnect()` | Close connection without triggering reconnect |
| `subscribe(matchId)` | Send `{ type: "subscribe", matchId }` to server |
| `unsubscribe(matchId)` | Send `{ type: "unsubscribe", matchId }` to server |
| `onMessage(handler)` | Register a `WsMessage` handler |
| `offMessage(handler)` | Remove a previously registered handler |

#### Reconnect lifecycle

```
connect() called
  │
  ├─ socket.onopen  → reset reconnectDelay to 1000ms
  │
  └─ socket.onclose (non-intentional)
       └─ scheduleReconnect():
            setTimeout(connect, reconnectDelay)
            reconnectDelay = min(reconnectDelay * 2, 30000)
```

---

## 7) Custom Hooks

### 7.1 `useMatches` — `src/hooks/useMatches.ts`

Manages the full list of matches. Called once at the `App` component root.

**Responsibilities:**
- Calls `wsClient.connect()` to establish the shared WebSocket connection.
- Fetches all matches via `fetchMatches()` on mount.
- Listens for `match_created` WS events → prepends new match to state.
- Listens for `match_updated` WS events → replaces the matching entry in state in-place (preserving array order, updating score and stats).
- Returns `{ matches, loading, error }`.

**State transitions:**

```
mount
  ├─ loading = true
  ├─ wsClient.connect()
  └─ fetchMatches()
       ├─ success → matches = data, loading = false
       └─ error   → error = message, loading = false

WS: match_created  → matches = [newMatch, ...prev]
WS: match_updated  → matches = prev.map(m => m.id === data.id ? data : m)
```

---

### 7.2 `useMatchDetail` — `src/hooks/useMatchDetail.ts`

Manages commentary for a single match. Called inside `CommentaryPanel` with the open match's `id`.

**Responsibilities:**
- Resets state and re-fetches whenever `matchId` changes.
- Calls `wsClient.subscribe(matchId)` to opt in to server-side scoped commentary broadcasts.
- Listens for `commentary` WS events matching the current `matchId` → prepends to commentary state.
- Calls `wsClient.unsubscribe(matchId)` on cleanup (when panel closes or matchId changes).
- Returns `{ commentary, loading, error }`.

**Effect lifecycle:**

```
matchId changes (or panel opens)
  ├─ setLoading(true), reset commentary and error
  ├─ fetchCommentary(matchId) → setCommentary(data)
  ├─ wsClient.subscribe(matchId)
  └─ register WS handler: commentary for this matchId → prepend

Cleanup (panel closes or matchId changes)
  ├─ wsClient.offMessage(handler)
  └─ wsClient.unsubscribe(matchId)
```

**Note:** If `matchId` is `null`, the hook clears commentary and returns immediately without fetching or subscribing.

---

## 8) Components

### 8.1 `App.tsx` — Root Layout

The application root. Manages all top-level state and orchestrates the layout.

**State:**

| State | Type | Description |
|---|---|---|
| `activeTab` | `Tab` | Currently selected filter tab |
| `commentaryId` | `number \| null` | ID of the match whose panel is open |

**Tab system:**

Four tabs: `live`, `scheduled` (labeled "Upcoming"), `finished`, `all`. Each tab shows a live count badge. Switching tab also closes any open commentary panel (`setCommentaryId(null)`).

**Layout structure:**

```
<div> (min-h-screen, bg-[#F0EFEB])
  ├─ <header>        Hero — black full-bleed, wordmark, live count badges
  ├─ <div sticky>    Tabs — sticky top-0 z-30, scrollable on mobile
  └─ <div>           Content area (lg:mr-110 when panel open)
       └─ match grid  1 col → 2 col (sm) → 3 col (lg)
            └─ <MatchCard /> × N
  ├─ backdrop div    Mobile/tablet (< lg) semi-opaque overlay, click to close
  └─ <CommentaryPanel />  Conditionally rendered when commentaryId is set
```

**Commentary panel offset:** When a panel is open, the content area gets `lg:mr-110` (440px margin-right) so the card grid doesn't slide under the fixed panel on large screens. On mobile/tablet, a `bg-black/60` backdrop overlays the grid instead.

**Loading state:** Shows 6 pulsing skeleton card placeholders (`animate-pulse`) while `loading` is true.

---

### 8.2 `MatchCard.tsx`

Displays a single football fixture. Receives the full `Match` object and commentary open state from `App`.

**Props:**

| Prop | Type | Description |
|---|---|---|
| `match` | `Match` | The fixture to display |
| `commentaryOpen` | `boolean` | Whether this card's panel is currently open |
| `onCommentaryToggle` | `() => void` | Called when the Commentary button is clicked |

**Visual structure:**

```
┌─────────────────────────────────┐
│ PREMIER LEAGUE          [LIVE]  │  ← Card header (bg-[#F0EFEB])
├─────────────────────────────────┤
│                                 │
│  Man City    │  –  │  Arsenal   │  ← Score section (text-6xl font-black)
│     2        │     │     1      │
│                                 │
│          Mar 3 · 15:00          │  ← Time row (hidden when live)
│                                 │
├─────────────────────────────────┤
│        [Commentary]             │  ← Toggle button
└─────────────────────────────────┘
```

**Shadow states:**
- Default: `shadow-[6px_6px_0px_#000]`, reduces on hover to `shadow-[3px_3px_0px_#000]`
- Commentary open: `shadow-[6px_6px_0px_#FAFF00]` (yellow offset shadow)

**Commentary button states:**
- Closed: black fill, white text, grey shadow — changes to yellow on hover
- Open: yellow fill, black text, no shadow, label changes to `✕ Close Commentary`

**Time display:** Uses `toLocaleDateString` + `toLocaleTimeString` with `[]` locale (user's system locale). Only shown for non-live matches with a `startTime`.

---

### 8.3 `CommentaryPanel.tsx`

A fixed right-side drawer that displays detailed match information across two tabs: **Commentary** and **Stats**.

**Props:**

| Prop | Type | Description |
|---|---|---|
| `match` | `Match` | The match whose panel is open |
| `onClose` | `() => void` | Called when the close button is clicked |

**Internal state:**

| State | Type | Description |
|---|---|---|
| `activeTab` | `'commentary' \| 'stats'` | Which tab is active (defaults to `'commentary'`) |

**Layout:**

```
Fixed: right-0, top-0, h-screen, w-full lg:w-110 (440px), z-50
shadow-[-8px_0px_0px_#000]  (left-side shadow)

┌──────────────────────────┐
│ LEAGUE NAME         [✕]  │  ← Black header
│ Home Team  vs  Away Team │
├──────────────────────────┤
│   Home  2  [LIVE]  1 Away│  ← Yellow scoreboard
├──────────────────────────┤
│ [COMMENTARY]   [STATS]   │  ← Tab switcher
├──────────────────────────┤
│                          │
│   scrollable content     │  ← Commentary feed OR Stats panel
│                          │
└──────────────────────────┘
```

**Tab switching:** Active tab button: `bg-black text-[#FAFF00]`. Inactive: `bg-white text-black hover:bg-[#FAFF00]`.

**Commentary tab:** Renders commentary entries via `useMatchDetail`. Shows loading, error, empty state, or the `CommentaryItem` list.

**Stats tab:** Shows `StatsPanel` if `match.stats` is non-null; otherwise shows a contextual empty state message ("Stats available once match kicks off" for scheduled, generic message for others).

#### Sub-component: `StatsPanel`

Renders a two-column stat comparison table (home | label | away).

- **Header row**: team name labels above the columns.
- **Possession row**: special treatment — shows percentage values with a visual `PossessionBar` below them.
- **All other rows**: `text-xl font-black` values with the stat label centered between them.
- Rows where both home and away values are `null` are skipped entirely.

#### Sub-component: `PossessionBar`

A simple split bar showing relative possession. Home side is black; away side is yellow (`#FAFF00`). Widths are driven by `parseInt` of the possession percentage strings.

---

### 8.4 `CommentaryItem.tsx`

Renders a single commentary event row.

**Visual structure:**

```
┌──────────────────────────────────────────────┐
│ [45']  [GOAL] PLAYER NAME (Team Name)        │
│        Full descriptive message here         │
└──────────────────────────────────────────────┘
```

- **Minute bubble**: black square with white text (`{minute}'`). Shows `—` when `minute` is null.
- **Event chip**: colored badge with bold label. Falls back to a gray chip with the raw event type uppercased for unknown types.
- **Actor**: player name in `font-black uppercase`.
- **Team**: team name in lighter `text-gray-400`.
- **Message**: descriptive text in `font-bold text-gray-800`.

**Event chip color map:**

| `eventType` | Background | Label |
|---|---|---|
| `goal` | `#4ADE80` (green) | GOAL |
| `own_goal` | `#FF3B30` (red) | OWN GOAL |
| `yellow_card` | `#FAFF00` (yellow) | YELLOW |
| `red_card` | `#FF3B30` (red) | RED |
| `substitution` | `#A5F3FC` (cyan) | SUB |
| `penalty` | `#FB923C` (orange) | PEN |
| `var` | `#E5E7EB` (gray) | VAR |
| `status_change` | `#E5E7EB` (gray) | INFO |
| `kickoff` | `#E5E7EB` (gray) | KO |
| `halftime` | `#E5E7EB` (gray) | HT |
| `fulltime` | `#E5E7EB` (gray) | FT |
| *(unknown)* | `#E5E7EB` (gray) | Uppercased raw value |

---

### 8.5 `StatusBadge.tsx`

Renders a status indicator chip for a match. Used in both `MatchCard` and `CommentaryPanel`.

| `status` | Background | Text | Extra |
|---|---|---|---|
| `live` | `#4ADE80` (green) | `LIVE` | Pulsing black dot |
| `scheduled` | `#A5F3FC` (cyan) | `UPCOMING` | — |
| `finished` | `#E5E7EB` (gray) | `FT` | — |

All badges: `border-2 border-black font-black text-xs uppercase tracking-widest`.

---

## 9) Design System

The frontend uses a **neo-brutalism** aesthetic throughout.

### 9.1 Core Principles

- **Thick borders**: `border-[3px] border-black` on cards and containers; `border-2 border-black` on badges and buttons.
- **Offset box shadows**: `shadow-[6px_6px_0px_#000]` creates an illusion of depth without rounded corners.
- **Maximum font weight**: `font-black` (weight 900) used for nearly all text.
- **All-caps typography**: `uppercase tracking-widest` for labels, headings, and badges.
- **No border radius**: square corners everywhere.
- **High contrast**: black on white, or black on electric yellow.

### 9.2 Color Palette

| Token | Hex | Usage |
|---|---|---|
| Off-white | `#F0EFEB` | Page background, card header background |
| Black | `#000000` | Borders, shadows, primary text, button fills |
| White | `#FFFFFF` | Card backgrounds, active button text |
| Electric yellow | `#FAFF00` | Accent color, active commentary shadow, active tabs, possession bar (away) |
| Green | `#4ADE80` | Live status badge, goal chip, hero live indicator |
| Cyan | `#A5F3FC` | Upcoming status badge, substitution chip |
| Red | `#FF3B30` | Red card, own goal chip, error text |
| Orange | `#FB923C` | Penalty chip |
| Gray | `#E5E7EB` | Finished badge, info/var/status chips |

### 9.3 Global Styles — `src/index.css`

```css
@import "tailwindcss";

/* Font smoothing globally */
* {
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
}

/* Page background */
body { background-color: #f0efeb; }

/* Custom thin scrollbar for commentary feed */
.commentary-scroll::-webkit-scrollbar       { width: 6px; }
.commentary-scroll::-webkit-scrollbar-track { background: #f0efeb; }
.commentary-scroll::-webkit-scrollbar-thumb { background: #000; }
```

The `.commentary-scroll` class is applied to the scrollable feed area inside `CommentaryPanel`.

---

## 10) Responsive Design

The layout adapts across three breakpoints using Tailwind CSS responsive prefixes.

| Breakpoint | Grid columns | Commentary panel | Tab bar |
|---|---|---|---|
| Default (mobile) | 1 column | Full-screen with `bg-black/60` backdrop | Scrollable horizontally |
| `sm` (≥ 640px) | 2 columns | Full-screen with backdrop | Scrollable horizontally |
| `lg` (≥ 1024px) | 3 columns | Fixed 440px right sidebar (`w-110`), content gets `mr-110` | All tabs visible |

**Mobile panel behavior:** `CommentaryPanel` is full-width on small screens. A semi-opaque `bg-black/60` backdrop is rendered behind the panel (in `App.tsx`) and is clickable to close it. The panel itself sits at `z-50`, the backdrop at `z-40`.

**Hero typography:** Scales from `text-6xl` (mobile) → `text-8xl` (sm) → `text-9xl` (lg) using responsive Tailwind prefixes.

---

## 11) Vite Configuration

**File:** `vite.config.ts`

### Dev Server Proxy

Vite's dev proxy rewrites requests so the frontend can call the backend without CORS issues during development:

| Frontend path | Backend target | Notes |
|---|---|---|
| `/api/*` | `http://127.0.0.1:8000/*` | Path prefix `/api` is stripped before forwarding |
| `/ws` | `ws://127.0.0.1:8000` | WebSocket proxy; `ws: true` enables upgrade handling |

In production, these paths must be handled by a reverse proxy (e.g. Nginx, or the hosting provider's proxy rules).

### Plugins

- `@vitejs/plugin-react` — React JSX transform and Fast Refresh (HMR).
- `@tailwindcss/vite` — Vite-native Tailwind CSS 4 integration; no separate PostCSS config required.

---

## 12) TypeScript Configuration

**File:** `tsconfig.app.json`

| Option | Value | Effect |
|---|---|---|
| `target` | `ES2022` | Modern JS output |
| `strict` | `true` | All strict checks enabled |
| `noUnusedLocals` | `true` | Errors on unused variables |
| `noUnusedParameters` | `true` | Errors on unused function params |
| `moduleResolution` | `bundler` | Vite-compatible module resolution |
| `verbatimModuleSyntax` | `true` | Enforces `import type` for type-only imports |
| `jsx` | `react-jsx` | React 17+ automatic JSX transform |
| `noEmit` | `true` | TypeScript is type-check only; Vite handles bundling |

---

## 13) Build and Development Scripts

From `frontend/package.json`:

```bash
npm run dev       # Start Vite dev server with HMR (http://localhost:5173)
npm run build     # tsc -b (type check) + vite build (production bundle)
npm run preview   # Serve the production build locally for verification
npm run lint      # ESLint across all src files
```

**Build output:** `dist/` directory containing `index.html` and hashed asset files (`index-*.js`, `index-*.css`).

---

## 14) Quick Start (Developer)

```bash
# From the project root
cd frontend

# Install dependencies
npm install

# Start development server
# Requires the backend to be running on port 8000
npm run dev
# → http://localhost:5173

# Production build
npm run build
# → dist/
```

The frontend expects the backend to be accessible at `http://127.0.0.1:8000` during development. Ensure the backend's `API_FOOTBALL_KEY` is set in `backend/.env` before starting, otherwise no match data will populate.

---

## 15) Component Dependency Map

```
App.tsx
  ├─ useMatches            (hooks/useMatches.ts)
  │    ├─ fetchMatches     (lib/api.ts)
  │    └─ wsClient         (lib/ws.ts)
  │
  ├─ MatchCard             (components/MatchCard.tsx)
  │    └─ StatusBadge      (components/StatusBadge.tsx)
  │
  └─ CommentaryPanel       (components/CommentaryPanel.tsx)
       ├─ useMatchDetail   (hooks/useMatchDetail.ts)
       │    ├─ fetchCommentary  (lib/api.ts)
       │    └─ wsClient        (lib/ws.ts)
       ├─ StatusBadge      (components/StatusBadge.tsx)
       └─ CommentaryItem   (components/CommentaryItem.tsx)
```
