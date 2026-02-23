import { useEffect, useState } from 'react';
import { fetchCommentary } from '../lib/api';
import { wsClient } from '../lib/ws';
import type { Commentary, WsMessage } from '../types';

export function useMatchDetail(matchId: number | null) {
  const [commentary, setCommentary] = useState<Commentary[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (matchId === null) {
      setCommentary([]);
      return;
    }

    setLoading(true);
    setError(null);
    setCommentary([]);

    fetchCommentary(matchId)
      .then((data) => setCommentary(data))
      .catch((err: unknown) =>
        setError(err instanceof Error ? err.message : 'Failed to load commentary')
      )
      .finally(() => setLoading(false));

    wsClient.subscribe(matchId);

    const handler = (msg: WsMessage) => {
      if (msg.type === 'commentary' && msg.data.matchId === matchId) {
        setCommentary((prev) => [msg.data, ...prev]);
      }
    };

    wsClient.onMessage(handler);

    return () => {
      wsClient.offMessage(handler);
      wsClient.unsubscribe(matchId);
    };
  }, [matchId]);

  return { commentary, loading, error };
}
