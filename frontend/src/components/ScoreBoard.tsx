import type { Match } from '../types';
import { StatusBadge } from './StatusBadge';

interface Props {
  match: Match;
}

export function ScoreBoard({ match }: Props) {
  return (
    <div className="px-6 py-5 border-b border-gray-200 bg-white">
      <div className="flex items-center gap-2 mb-4">
        <span className="text-xs font-medium text-gray-400 uppercase tracking-wider">
          {match.sport}
        </span>
        <StatusBadge status={match.status} />
      </div>

      <div className="flex items-center justify-between gap-4">
        <div className="flex-1 text-center">
          <p className="text-base font-semibold text-gray-700 truncate">{match.homeTeam}</p>
          <p className="text-5xl font-bold text-gray-900 tabular-nums mt-1">
            {match.homeScore}
          </p>
        </div>

        <div className="shrink-0 text-2xl font-light text-gray-300 select-none">–</div>

        <div className="flex-1 text-center">
          <p className="text-base font-semibold text-gray-700 truncate">{match.awayTeam}</p>
          <p className="text-5xl font-bold text-gray-900 tabular-nums mt-1">
            {match.awayScore}
          </p>
        </div>
      </div>
    </div>
  );
}
