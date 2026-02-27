import type { Match } from '../types';
import { StatusBadge } from './StatusBadge';

interface Props {
  match: Match;
  selected: boolean;
  onSelect: (id: number) => void;
}

export function MatchListItem({ match, selected, onSelect }: Props) {
  return (
    <button
      onClick={() => onSelect(match.id)}
      className={`w-full text-left px-4 py-3 border-b border-gray-100 transition-colors focus:outline-none ${selected
          ? 'bg-blue-50 border-l-2 border-l-blue-500'
          : 'hover:bg-gray-50 border-l-2 border-l-transparent'
        }`}
    >
      <div className="flex items-center justify-between mb-1">
        <span className="text-xs font-medium text-gray-400 uppercase tracking-wider">
          {match.sport}{match.league ? ` · ${match.league}` : ''}
        </span>
        <StatusBadge status={match.status} />
      </div>
      <div className="flex items-center justify-between gap-2">
        <span className="text-sm font-semibold text-gray-800 truncate flex-1">
          {match.homeTeam}
        </span>
        <span className="text-sm font-bold text-gray-700 tabular-nums shrink-0">
          {match.homeScore} – {match.awayScore}
        </span>
        <span className="text-sm font-semibold text-gray-800 truncate flex-1 text-right">
          {match.awayTeam}
        </span>
      </div>
    </button>
  );
}
