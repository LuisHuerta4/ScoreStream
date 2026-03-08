import express from 'express';
import http from 'http';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { matchesRouter } from './routes/matches.js';
import { attachWebSocketServer } from './ws/server.js';
import { securityMiddleware } from './arcjet.js';
import { commentaryRouter } from './routes/commentary.js';
import { startSportSync } from './services/sportSync.js';
import { startCleanupJob } from './services/cleanupJob.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const FRONTEND_DIST = join(__dirname, '../../frontend/dist');

const PORT = Number(process.env.PORT) || 8000;
const HOST = process.env.HOST || '0.0.0.0';

const app = express();
const server = http.createServer(app);

app.use(express.json());
app.use(securityMiddleware());

app.use('/api/matches', matchesRouter);
app.use('/api/matches/:id/commentary', commentaryRouter);

const { broadcastMatchCreated, broadcastCommentary, broadcastMatchUpdated } = attachWebSocketServer(server);
app.locals.broadcastMatchCreated = broadcastMatchCreated;
app.locals.broadcastCommentary = broadcastCommentary;

startSportSync({ broadcastMatchCreated, broadcastCommentary, broadcastMatchUpdated });
startCleanupJob();

app.use(express.static(FRONTEND_DIST));
app.get('*', (_req, res) => {
    res.sendFile(join(FRONTEND_DIST, 'index.html'));
});

server.listen(PORT, HOST, () => {
    const baseUrl = HOST === '0.0.0.0' ? `http://localhost:${PORT}` : `http://${HOST}:${PORT}`;

    console.log(`Server is running at ${baseUrl}`);
    console.log(`WebSocket server is running on ${baseUrl.replace('http', 'ws')}/ws`);
})