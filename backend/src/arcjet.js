import arcjet, { detectBot, slidingWindow, shield } from '@arcjet/node';

const arcjetKey = process.env.ARCJET_KEY;
const arcjetMode = process.env.ARCJET_MODE === 'DRY_RUN' ? 'DRY_RUN' : 'LIVE';

if (!arcjetKey) throw new Error('ARCJET_KEY is not set in environment variables');

export const httpArcjet = arcjetKey ?
    arcjet({
        key: arcjetKey,
        rules: [
            shield({ mode: arcjetMode }),
            detectBot({ mode: arcjetMode, allow: ['CATEGORY:SEARCH_ENGINE', 'CATEGORY:PREVIEW'] }),
            slidingWindow({ mode: arcjetMode, interval: '10s', max: 50 }) // MAX 50 request every 10s per IP adress
        ]
    }) : null;

export const wsArcjet = arcjetKey ?
    arcjet({
        key: arcjetKey,
        rules: [
            shield({ mode: arcjetMode }),
            detectBot({ mode: arcjetMode, allow: ['CATEGORY:SEARCH_ENGINE', 'CATEGORY:PREVIEW'] }),
            slidingWindow({ mode: arcjetMode, interval: '2s', max: 5 }) // Only 5 connection attempts every 2s
        ]
    }) : null;

export function getRequestIp(req) {
    const ip = req.ip
        || (typeof req.headers['x-forwarded-for'] === 'string' && req.headers['x-forwarded-for'].split(',')[0].trim())
        || req.socket?.remoteAddress;
    return ip && ip.trim() ? ip.trim() : null;
}

export function securityMiddleware() {
    return async (req, res, next) => {
        const ip = getRequestIp(req);
        if (!httpArcjet || !ip) return next();

        try {
            const decision = await httpArcjet.protect(req, { ip });

            if (decision.isDenied()) {
                if (decision.reason.isRateLimit()) {
                    return res.status(429).json({ error: 'Too Many Requests' });
                }
                return res.status(403).json({ error: 'Forbidden' });
            }

        } catch (e) {
            console.error('Error in Arcjet middleware:', e);
            return res.status(503).json({ error: 'Service Unavailable' });
        }

        next();
    }
}