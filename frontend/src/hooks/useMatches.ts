import { useEffect, useState } from 'react';
import { fetchMatches } from '../lib/api';
import { wsClient } from '../lib/ws';
import type { Match, WsMessage } from '../types';

export function useMatches() {
  const [matches, setMatches] = useState<Match[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    wsClient.connect();

    fetchMatches()
      .then((data) => setMatches(data))
      .catch((err: unknown) =>
        setError(err instanceof Error ? err.message : 'Failed to load matches')
      )
      .finally(() => setLoading(false));

    const handler = (msg: WsMessage) => {
      if (msg.type === 'match_created') {
        setMatches((prev) => [msg.data, ...prev]);
      }
    };

    wsClient.onMessage(handler);
    return () => wsClient.offMessage(handler);
  }, []);

  return { matches, loading, error };
}
