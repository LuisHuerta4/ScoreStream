export type MatchStatus = 'scheduled' | 'live' | 'finished';

export interface TeamStats {
  possession: string | null;
  shotsOnGoal: number | null;
  totalShots: number | null;
  corners: number | null;
  fouls: number | null;
  yellowCards: number | null;
  redCards: number | null;
  offsides: number | null;
  passAccuracy: string | null;
}

export interface MatchStats {
  home: TeamStats;
  away: TeamStats;
}

export interface Match {
  id: number;
  sport: string;
  league: string | null;
  homeTeam: string;
  awayTeam: string;
  status: MatchStatus;
  homeScore: number;
  awayScore: number;
  stats: MatchStats | null;
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
  | { type: 'match_updated'; data: Match }
  | { type: 'commentary'; data: Commentary }
  | { type: 'error'; message: string };
