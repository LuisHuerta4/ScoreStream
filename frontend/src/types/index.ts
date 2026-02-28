export type MatchStatus = 'scheduled' | 'live' | 'finished';

export interface Match {
  id: number;
  sport: string;
  league: string | null;
  homeTeam: string;
  awayTeam: string;
  status: MatchStatus;
  homeScore: number;
  awayScore: number;
  startTime: string | null;
  endTime: string | null;
  createdAt: string;
}

export interface Commentary {
  id: number;
  matchId: number;
  minute: number | null;
  sequence: number | null;
  period: string | null;
  eventType: string | null;
  actor: string | null;
  team: string | null;
  message: string;
  metadata: Record<string, unknown> | null;
  tags: string[] | null;
  createdAt: string;
}

// WebSocket message types
export type WsMessage =
  | { type: 'welcome' }
  | { type: 'subscribed'; matchId: number }
  | { type: 'unsubscribed'; matchId: number }
  | { type: 'match_created'; data: Match }
  | { type: 'commentary'; data: Commentary }
  | { type: 'error'; message: string };
