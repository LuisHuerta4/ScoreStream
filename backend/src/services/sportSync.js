import { db } from '../db/db.js';
import { matches, commentary } from '../db/schema.js';
import { eq, and, lte, or } from 'drizzle-orm';

const BASE_URL = 'https://v3.football.api-sports.io';
const POLL_INTERVAL_MS = 20 * 60 * 1000; // 20 minutes — keeps usage ~92 requests/day on free tier

// Tracked league IDs (API-Football)
// 39=Premier League, 140=La Liga, 78=Bundesliga, 135=Serie A, 61=Ligue 1, 2=UCL, 3=UEL
const LEAGUE_IDS = new Set([39, 140, 78, 135, 61, 2, 3]);

const LIVE_STATUSES = new Set(['1H', 'HT', '2H', 'ET', 'P', 'BT', 'LIVE', 'INT']);
const FINISH_STATUSES = new Set(['FT', 'AET', 'PEN', 'CANC', 'ABD', 'AWD', 'WO']);

// Map API-Football statistic type labels to normalized camelCase keys
const STAT_MAP = {
    'Ball Possession':  'possession',
    'Shots on Goal':    'shotsOnGoal',
    'Total Shots':      'totalShots',
    'Corner Kicks':     'corners',
    'Fouls':            'fouls',
    'Yellow Cards':     'yellowCards',
    'Red Cards':        'redCards',
    'Offsides':         'offsides',
    'Passes %':         'passAccuracy',
};

// Map<externalId_string, { matchId, status, homeScore, awayScore, homeTeam, awayTeam, processedEventKeys: Set<string> }>
const syncState = new Map();

// API helper
async function apiFetch(path) {
    const key = process.env.API_FOOTBALL_KEY;
    if (!key || key === 'your_api_football_key_here') {
        throw new Error('API_FOOTBALL_KEY is not set in .env');
    }
    const res = await fetch(`${BASE_URL}${path}`, {
        headers: { 'x-apisports-key': key },
    });
    if (!res.ok) throw new Error(`HTTP ${res.status} for ${BASE_URL}${path}`);
    const body = await res.json();
    return body.response ?? [];
}

// Status mapping
function mapStatus(shortStatus) {
    if (LIVE_STATUSES.has(shortStatus)) return 'live';
    if (FINISH_STATUSES.has(shortStatus)) return 'finished';
    return 'scheduled';
}

// Event deduplication key
function buildEventKey(minute, eventType, actor) {
    return `${minute ?? 0}_${eventType ?? ''}_${(actor ?? '').toLowerCase().replace(/\s+/g, '_')}`;
}

// Event -> commentary mapping
function mapEvent(event) {
    const minute = event.time?.elapsed ?? null;
    const playerName = event.player?.name ?? null;
    const teamName = event.team?.name ?? null;
    const type = event.type;
    const detail = event.detail ?? '';

    if (type === 'Goal') {
        if (detail === 'Own Goal') {
            return {
                minute, eventType: 'own_goal', actor: playerName, team: teamName,
                message: `OWN GOAL! ${playerName} puts it into their own net! (${teamName})`,
            };
        }
        const isPen = detail === 'Penalty';
        return {
            minute, eventType: isPen ? 'penalty' : 'goal', actor: playerName, team: teamName,
            message: `GOAL! ${playerName} scores for ${teamName}!${isPen ? ' (Penalty)' : ''}`,
        };
    }

    if (type === 'Card') {
        const isRed = detail === 'Red Card' || detail === 'Yellow Red Card';
        return {
            minute, eventType: isRed ? 'red_card' : 'yellow_card', actor: playerName, team: teamName,
            message: isRed
                ? `RED CARD! ${playerName} is sent off! (${teamName})`
                : `Yellow card shown to ${playerName} (${teamName})`,
        };
    }

    if (type === 'subst') {
        const playerOff = event.player?.name ?? null;
        const playerOn = event.assist?.name ?? null;
        return {
            minute, eventType: 'substitution', actor: playerOn, team: teamName,
            message: `Substitution: ${playerOn} comes on for ${playerOff} (${teamName})`,
        };
    }

    if (type === 'Var') {
        return {
            minute, eventType: 'var', actor: null, team: teamName,
            message: `VAR: ${detail}`,
        };
    }

    return null;
}

// Commentary insertion
async function insertCommentary(matchId, fields, broadcastCommentary) {
    try {
        const [row] = await db.insert(commentary).values({
            matchId,
            minute: fields.minute ?? null,
            eventType: fields.eventType ?? null,
            team: fields.team ?? null,
            actor: fields.actor ?? null,
            period: fields.period ?? null,
            message: fields.message,
        }).returning();
        broadcastCommentary(matchId, row);
    } catch (err) {
        console.error(`[SoccerSync] Failed to insert commentary for match ${matchId}:`, err.message);
    }
}

// Load syncState from DB (restores state after server restart)
async function loadStateFromDb(externalId) {
    const [row] = await db.select().from(matches)
        .where(eq(matches.externalId, externalId)).limit(1);
    if (!row) return null;

    const existing = await db
        .select({ minute: commentary.minute, eventType: commentary.eventType, actor: commentary.actor })
        .from(commentary)
        .where(eq(commentary.matchId, row.id));

    return {
        matchId: row.id,
        status: row.status,
        homeScore: row.homeScore,
        awayScore: row.awayScore,
        homeTeam: row.homeTeam,
        awayTeam: row.awayTeam,
        processedEventKeys: new Set(existing.map(c => buildEventKey(c.minute, c.eventType, c.actor))),
    };
}

// Fetch match statistics from API and store in DB
async function processStats(externalId, matchId, broadcastMatchUpdated) {
    try {
        const data = await apiFetch(`/fixtures/statistics?fixture=${externalId}`);
        if (!data || data.length < 2) return;

        function buildTeamStats(teamData) {
            const out = {};
            for (const s of teamData.statistics) {
                const key = STAT_MAP[s.type];
                if (key !== undefined) out[key] = s.value;
            }
            return out;
        }

        const statsPayload = {
            home: buildTeamStats(data[0]),
            away: buildTeamStats(data[1]),
        };

        const [updated] = await db.update(matches)
            .set({ stats: statsPayload })
            .where(eq(matches.id, matchId))
            .returning();

        if (updated) broadcastMatchUpdated(updated);
    } catch (err) {
        console.error(`[SoccerSync] Failed to fetch stats for fixture ${externalId}:`, err.message);
    }
}

// Fetch and insert new events for a fixture
async function processEvents(externalId, matchId, broadcastCommentary) {
    const state = syncState.get(externalId);
    if (!state) return;

    const events = await apiFetch(`/fixtures/events?fixture=${externalId}`);

    for (const event of events) {
        const mapped = mapEvent(event);
        if (!mapped) continue;
        const key = buildEventKey(mapped.minute, mapped.eventType, mapped.actor);
        if (state.processedEventKeys.has(key)) continue;

        await insertCommentary(matchId, mapped, broadcastCommentary);
        state.processedEventKeys.add(key);
    }
}

// Core fixture upsert
async function processFixture(fixture, broadcasts) {
    const externalId = String(fixture.fixture.id);
    const shortStatus = fixture.fixture.status.short;
    const newStatus = mapStatus(shortStatus);
    const newHome = fixture.goals.home ?? 0;
    const newAway = fixture.goals.away ?? 0;
    const startTime = fixture.fixture.date ? new Date(fixture.fixture.date) : null;
    const homeTeam = fixture.teams.home.name;
    const awayTeam = fixture.teams.away.name;
    const league = fixture.league.name;

    let state = syncState.get(externalId) ?? await loadStateFromDb(externalId);

    if (!state) {
        // New match — INSERT
        try {
            const [inserted] = await db.insert(matches).values({
                externalId,
                sport: 'Soccer',
                league,
                homeTeam,
                awayTeam,
                status: newStatus,
                startTime,
                endTime: startTime ? new Date(startTime.getTime() + 2 * 60 * 60 * 1000) : null,
                homeScore: newHome,
                awayScore: newAway,
            }).returning();

            broadcasts.broadcastMatchCreated(inserted);

            state = {
                matchId: inserted.id,
                status: newStatus,
                homeScore: newHome,
                awayScore: newAway,
                homeTeam,
                awayTeam,
                processedEventKeys: new Set(),
            };
            syncState.set(externalId, state);

            if (newStatus === 'live') {
                await insertCommentary(inserted.id, { eventType: 'status_change', message: 'Kick off!' }, broadcasts.broadcastCommentary);
                await processEvents(externalId, inserted.id, broadcasts.broadcastCommentary);
                await processStats(externalId, inserted.id, broadcasts.broadcastMatchUpdated);
            }
        } catch (err) {
            if (err.code !== '23505') {
                console.error(`[SoccerSync] Failed to insert fixture ${externalId}:`, err.message);
            }
        }
        return;
    }

    const statusChanged = newStatus !== state.status;
    const scoreChanged = newHome !== state.homeScore || newAway !== state.awayScore;

    if (!statusChanged && !scoreChanged) {
        syncState.set(externalId, state);
        return;
    }

    // UPDATE match
    try {
        await db.update(matches)
            .set({ status: newStatus, homeScore: newHome, awayScore: newAway })
            .where(eq(matches.id, state.matchId));
    } catch (err) {
        console.error(`[SoccerSync] Failed to update fixture ${externalId}:`, err.message);
        return;
    }

    syncState.set(externalId, { ...state, status: newStatus, homeScore: newHome, awayScore: newAway });

    // Status-transition commentary
    if (statusChanged) {
        if (state.status === 'scheduled' && newStatus === 'live') {
            await insertCommentary(state.matchId, { eventType: 'status_change', message: 'Kick off!' }, broadcasts.broadcastCommentary);
        } else if (state.status !== 'finished' && newStatus === 'finished') {
            await insertCommentary(state.matchId, {
                eventType: 'status_change',
                message: `Full time! ${homeTeam} ${newHome} - ${newAway} ${awayTeam}`,
            }, broadcasts.broadcastCommentary);
        }
    }

    // Fetch new events when something changed (deduplication prevents re-insertion)
    await processEvents(externalId, state.matchId, broadcasts.broadcastCommentary);

    // Fetch updated stats for live/finished matches
    if (newStatus === 'live' || newStatus === 'finished') {
        await processStats(externalId, state.matchId, broadcasts.broadcastMatchUpdated);
    }
}

// Orchestrator
async function syncAll(broadcasts) {
    const today = new Date().toISOString().slice(0, 10);
    const fixtures = await apiFetch(`/fixtures?date=${today}`); // 1 API request per poll

    for (const fixture of fixtures) {
        if (!LEAGUE_IDS.has(fixture.league.id)) continue; // only tracked leagues
        await processFixture(fixture, broadcasts).catch((err) =>
            console.error(`[SoccerSync] Unhandled error for fixture ${fixture.fixture.id}:`, err.message)
        );
    }

    await correctStaleStatuses(broadcasts.broadcastMatchUpdated);
}

async function correctStaleStatuses(broadcastMatchUpdated) {
    const now = new Date();

    try {
        // scheduled/live matches whose endTime has passed → finished
        const finishedRows = await db.update(matches)
            .set({ status: 'finished' })
            .where(and(
                or(eq(matches.status, 'scheduled'), eq(matches.status, 'live')),
                lte(matches.endTime, now)
            ))
            .returning();

        // scheduled matches whose startTime has passed but endTime hasn't → live
        const liveRows = await db.update(matches)
            .set({ status: 'live' })
            .where(and(
                eq(matches.status, 'scheduled'),
                lte(matches.startTime, now)
            ))
            .returning();

        for (const row of [...finishedRows, ...liveRows]) {
            broadcastMatchUpdated(row);
        }

        const total = finishedRows.length + liveRows.length;
        if (total > 0) {
            console.log(`[SoccerSync] Corrected ${total} stale match statuses`);
        }
    } catch (err) {
        console.error('[SoccerSync] Failed to correct stale statuses:', err.message);
    }
}

// Public export
export function startSportSync({ broadcastMatchCreated, broadcastCommentary, broadcastMatchUpdated }) {
    const broadcasts = { broadcastMatchCreated, broadcastCommentary, broadcastMatchUpdated };

    console.log('[SoccerSync] Starting soccer sync service (polls every 20 min)...');

    syncAll(broadcasts).catch((err) =>
        console.error('[SoccerSync] Initial sync failed:', err.message)
    );

    setInterval(() =>
        syncAll(broadcasts).catch((err) =>
            console.error('[SoccerSync] Scheduled sync failed:', err.message)
        ),
        POLL_INTERVAL_MS
    );
}