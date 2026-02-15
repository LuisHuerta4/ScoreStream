import { Router } from 'express';
import { createMatchSchema, listMatchesQuerySchema } from '../validation/matches';
import { matches } from '../db/schema.js';
import { db } from '../db/db.js';
import { getMatchStatus } from '../utils/matchUtils.js';
import { desc } from 'drizzle-orm';

export const matchesRouter = Router();

const MAX_LIMIT = 100;

matchesRouter.get('/', async (req, res) => {
    const parsed = listMatchesQuerySchema.safeParse(req.query);

    if (!parsed.success) {
        return res.status(400).json({ error: 'Invalid query parameters', details: parsed.error.issues });
    }

    const limit = Math.min(parsed.data.limit ?? 50, MAX_LIMIT); // Default to 50 if not provided, max 100

    try {
        const data = await db
            .select()
            .from(matches)
            .orderBy((desc(matches.createdAt)))
            .limit(limit);

        res.json({ data });
    } catch (e) {
        res.status(500).json({ error: 'Failed to list matches.' });
    }
})

matchesRouter.post('/', async (req, res) => {
    const parsed = createMatchSchema.safeParse(req.body);

    if (!parsed.success) {
        return res.status(400).json({ error: 'Invalid payload', details: parsed.error.issues });
    }

    const { data: { startTime, endTime, homeScore, awayScore } } = parsed;

    try {
        const [event] = await db.insert(matches).values({
            ...parsed.data,
            startTime: new Date(startTime),
            endTime: new Date(endTime),
            homeScore: homeScore ?? 0,
            awayScore: awayScore ?? 0,
            status: getMatchStatus(startTime, endTime),
        }).returning(); // Return the inserted record with the generated ID

        res.status(201).json({ message: 'Match created successfully', data: event });
    } catch (e) {
        res.status(500).json({ error: 'Failed to create match', details: JSON.stringify(e) });
    }
})