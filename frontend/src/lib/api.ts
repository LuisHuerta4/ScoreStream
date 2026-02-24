import type { Commentary, Match } from '../types';

const BASE = '/api';

export async function fetchMatches(): Promise<Match[]> {
  const res = await fetch(`${BASE}/matches`);
  if (!res.ok) throw new Error(`Failed to fetch matches: ${res.status}`);
  const json = await res.json();
  return json.data as Match[];
}

export async function fetchCommentary(matchId: number): Promise<Commentary[]> {
  const res = await fetch(`${BASE}/matches/${matchId}/commentary?limit=100`);
  if (!res.ok) throw new Error(`Failed to fetch commentary: ${res.status}`);
  const json = await res.json();
  return json.data as Commentary[];
}
