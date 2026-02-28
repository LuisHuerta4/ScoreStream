import { db } from '../db/db.js';
import { matches, commentary } from '../db/schema.js';
import { eq } from 'drizzle-orm';

const BASE_URL = 'https://www.thesportsdb.com/api/v1/json/123';
const POLL_INTERVAL_MS = 60_000;
const SPORTS = ['Soccer', 'Basketball', 'Ice Hockey'];

// Estimated match durations in ms per sport
const DURATION_MS = {
    Soccer: 2 * 60 * 60 * 1000,
    Basketball: 2.5 * 60 * 60 * 1000,
    'Ice Hockey': 2 * 60 * 60 * 1000,
};

// In-Memory State

// Map<externalId, { matchId, homeScore, awayScore, status, homeTeam, awayTeam }>
const syncState = new Map();

// Status Mapping

function mapStatus(strStatus, startTime) {
    if (!strStatus) return deriveStatusFromTime(startTime);

    const s = strStatus.trim().toLowerCase();

    if (s === 'match finished' || s === 'ft' || s === 'aet' || s === 'pen') {
        return 'finished';
    }

    if (s === '1h' || s === 'ht' || s === '2h' || s === 'et' || s === 'p' || s === 'bt') {
        return 'live';
    }

    return deriveStatusFromTime(startTime);
}

function deriveStatusFromTime(startTime) {
    if (!startTime) return 'scheduled';
    return Date.now() < startTime.getTime() ? 'scheduled' : 'live';
}

// Time Helpers

function buildStartTime(dateEvent, strTime) {
    if (!dateEvent) return null;
    const time = (strTime && strTime !== '00:00:00') ? strTime : '00:00:00';
    const d = new Date(`${dateEvent}T${time}Z`);
    return Number.isNaN(d.getTime()) ? null : d;
}

function buildEndTime(startTime, sport) {
    if (!startTime) return null;
    return new Date(startTime.getTime() + (DURATION_MS[sport] ?? DURATION_MS['Soccer']));
}

// Score Normalisation

function parseScore(raw) {
    if (raw === null || raw === undefined || raw === '') return 0;
    const n = parseInt(raw, 10);
    return Number.isNaN(n) ? 0 : n;
}

// API Fetch

async function fetchEventsForDate(sport, dateString) {
    const sportParam = encodeURIComponent(sport).replace(/%20/g, '+');
    const url = `${BASE_URL}/eventsday.php?d=${dateString}&s=${sportParam}`;

    try {
        const response = await fetch(url);
        if (!response.ok) {
            console.error(`[SportSync] HTTP ${response.status} fetching ${sport} for ${dateString}`);
            return [];
        }
        const body = await response.json();
        return Array.isArray(body?.events) ? body.events : [];
    } catch (err) {
        console.error(`[SportSync] Failed to fetch ${sport} events:`, err.message);
        return [];
    }
}

// Commentary Insertion

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
        console.error(`[SportSync] Failed to insert commentary for match ${matchId}:`, err.message);
    }
}

// Core Upsert Logic

async function upsertMatch(event, { broadcastMatchCreated, broadcastCommentary }) {
    if (event.strPostponed === 'yes') return;

    const externalId = String(event.idEvent);
    const sport = event.strSport ?? 'Soccer';
    const startTime = buildStartTime(event.dateEvent, event.strTime);
    const endTime = buildEndTime(startTime, sport);
    const newHomeScore = parseScore(event.intHomeScore);
    const newAwayScore = parseScore(event.intAwayScore);
    const newStatus = mapStatus(event.strStatus, startTime);

    // Check if match already exists
    const existing = await db
        .select()
        .from(matches)
        .where(eq(matches.externalId, externalId))
        .limit(1);

    if (existing.length === 0) {
        // INSERT new match
        try {
            const [inserted] = await db.insert(matches).values({
                externalId,
                sport,
                league: event.strLeague ?? null,
                homeTeam: event.strHomeTeam,
                awayTeam: event.strAwayTeam,
                status: newStatus,
                startTime,
                endTime,
                homeScore: newHomeScore,
                awayScore: newAwayScore,
            }).returning();

            broadcastMatchCreated(inserted);

            syncState.set(externalId, {
                matchId: inserted.id,
                homeScore: newHomeScore,
                awayScore: newAwayScore,
                status: newStatus,
                homeTeam: inserted.homeTeam,
                awayTeam: inserted.awayTeam,
            });

            if (newStatus === 'live') {
                await insertCommentary(inserted.id, {
                    eventType: 'status_change',
                    message: 'Match kicked off',
                    period: '1H',
                }, broadcastCommentary);
            }
        } catch (err) {
            // 23505 = unique_violation — concurrent poll already inserted this row
            if (err.code !== '23505') {
                console.error(`[SportSync] Failed to insert match ${externalId}:`, err.message);
            }
        }
        return;
    }

    // UPDATE existing match
    const row = existing[0];
    const matchId = row.id;

    const prior = syncState.get(externalId) ?? {
        matchId,
        homeScore: row.homeScore,
        awayScore: row.awayScore,
        status: row.status,
        homeTeam: row.homeTeam,
        awayTeam: row.awayTeam,
    };

    const scoreChanged = newHomeScore !== prior.homeScore || newAwayScore !== prior.awayScore;
    const statusChanged = newStatus !== prior.status;

    if (!scoreChanged && !statusChanged) {
        syncState.set(externalId, { ...prior });
        return;
    }

    // Write updates to DB
    try {
        await db.update(matches).set({
            homeScore: newHomeScore,
            awayScore: newAwayScore,
            status: newStatus,
            ...(startTime ? { startTime } : {}),
            ...(endTime ? { endTime } : {}),
        }).where(eq(matches.id, matchId));
    } catch (err) {
        console.error(`[SportSync] Failed to update match ${matchId}:`, err.message);
        return;
    }

    syncState.set(externalId, {
        matchId,
        homeScore: newHomeScore,
        awayScore: newAwayScore,
        status: newStatus,
        homeTeam: prior.homeTeam,
        awayTeam: prior.awayTeam,
    });

    // Status transition commentary
    if (statusChanged) {
        if (prior.status === 'scheduled' && newStatus === 'live') {
            await insertCommentary(matchId, {
                eventType: 'status_change',
                message: 'Match kicked off',
                period: '1H',
            }, broadcastCommentary);
        } else if (prior.status !== 'finished' && newStatus === 'finished') {
            await insertCommentary(matchId, {
                eventType: 'status_change',
                message: `Full time! Final score: ${prior.homeTeam} ${newHomeScore} - ${newAwayScore} ${prior.awayTeam}`,
            }, broadcastCommentary);
        }
    }

    // Score change commentary
    if (scoreChanged) {
        const homeDelta = newHomeScore - prior.homeScore;
        const awayDelta = newAwayScore - prior.awayScore;

        for (let i = 1; i <= homeDelta; i++) {
            const h = prior.homeScore + i;
            const a = prior.awayScore;
            await insertCommentary(matchId, {
                eventType: 'goal',
                team: prior.homeTeam,
                message: `GOAL! ${prior.homeTeam} score! It's now ${prior.homeTeam} ${h} - ${a} ${prior.awayTeam}`,
            }, broadcastCommentary);
        }

        for (let i = 1; i <= awayDelta; i++) {
            const h = newHomeScore;
            const a = prior.awayScore + i;
            await insertCommentary(matchId, {
                eventType: 'goal',
                team: prior.awayTeam,
                message: `GOAL! ${prior.awayTeam} score! It's now ${prior.homeTeam} ${h} - ${a} ${prior.awayTeam}`,
            }, broadcastCommentary);
        }
    }
}

// Orchestrator

async function syncAll(broadcasts) {
    // Build the last 2 calendar dates in UTC (today, yesterday) — matches the 2-day deletion window
    const dates = [0, 1].map((offset) => {
        const d = new Date(Date.now() - offset * 24 * 60 * 60 * 1000);
        return d.toISOString().slice(0, 10);
    });

    for (const date of dates) {
        for (const sport of SPORTS) {
            const events = await fetchEventsForDate(sport, date);
            for (const event of events) {
                await upsertMatch(event, broadcasts).catch((err) => {
                    console.error(`[SportSync] Unhandled error for event ${event.idEvent}:`, err.message);
                });
            }
        }
    }
}

// Public Export

export function startSportSync({ broadcastMatchCreated, broadcastCommentary }) {
    const broadcasts = { broadcastMatchCreated, broadcastCommentary };

    console.log('[SportSync] Starting sport sync service…');

    syncAll(broadcasts).catch((err) => {
        console.error('[SportSync] Initial sync failed:', err.message);
    });

    setInterval(() => {
        syncAll(broadcasts).catch((err) => {
            console.error('[SportSync] Scheduled sync failed:', err.message);
        });
    }, POLL_INTERVAL_MS);
}