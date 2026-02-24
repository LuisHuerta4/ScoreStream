import type { Match } from '../types';
import { MatchListItem } from './MatchListItem';

interface Props {
  matches: Match[];
  selectedId: number | null;
  loading: boolean;
  error: string | null;
  onSelect: (id: number) => void;
}

export function MatchList({ matches, selectedId, loading, error, onSelect }: Props) {
  return (
    <aside className="w-80 shrink-0 border-r border-gray-200 flex flex-col bg-white">
      <div className="px-4 py-3 border-b border-gray-200">
        <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wider">
          Matches
        </h2>
      </div>

      <div className="overflow-y-auto flex-1">
        {loading && (
          <div className="px-4 py-6 text-sm text-gray-400 text-center">
            Loading matches...
          </div>
        )}
        {error && (
          <div className="px-4 py-6 text-sm text-red-500 text-center">
            {error}
          </div>
        )}
        {!loading && !error && matches.length === 0 && (
          <div className="px-4 py-6 text-sm text-gray-400 text-center">
            No matches yet.
          </div>
        )}
        {matches.map((match) => (
          <MatchListItem
            key={match.id}
            match={match}
            selected={match.id === selectedId}
            onSelect={onSelect}
          />
        ))}
      </div>
    </aside>
  );
}
