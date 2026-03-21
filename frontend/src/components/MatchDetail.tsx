import type { Match } from '../types';
import { useMatchDetail } from '../hooks/useMatchDetail';
import { ScoreBoard } from './ScoreBoard';
import { CommentaryFeed } from './CommentaryFeed';

interface Props {
  match: Match;
}

export function MatchDetail({ match }: Props) {
  const { commentary, loading, error } = useMatchDetail(match.id);

  return (
    <div className="flex flex-col flex-1 overflow-hidden">
      <ScoreBoard match={match} />
      <CommentaryFeed commentary={commentary} loading={loading} error={error} matchStatus={match.status} />
    </div>
  );
}
