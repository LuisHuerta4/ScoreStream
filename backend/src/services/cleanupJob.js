import { db } from '../db/db.js';
import { matches } from '../db/schema.js';
import { lt, or, and, isNotNull, isNull } from 'drizzle-orm';

const CLEANUP_INTERVAL_MS = 12 * 60 * 60 * 1000; // 12 hours

async function runCleanup() {
    const cutoff = new Date(Date.now() - 2 * 24 * 60 * 60 * 1000);

    try {
        const deleted = await db
            .delete(matches)
            .where(
                or(
                    and(isNotNull(matches.startTime), lt(matches.startTime, cutoff)),
                    and(isNull(matches.startTime), lt(matches.createdAt, cutoff))
                )
            )
            .returning({ id: matches.id });

        if (deleted.length > 0) {
            console.log(`[Cleanup] Deleted ${deleted.length} expired match(es) and their commentary.`);
        }
    } catch (err) {
        console.error('[Cleanup] Failed to run cleanup:', err.message);
    }
}

export function startCleanupJob() {
    console.log('[Cleanup] Starting cleanup job (runs every 12 hours)...');
    runCleanup();
    setInterval(runCleanup, CLEANUP_INTERVAL_MS);
}
