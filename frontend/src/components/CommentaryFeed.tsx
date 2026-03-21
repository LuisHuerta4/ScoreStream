import type { Commentary, MatchStatus } from '../types';
import { CommentaryItem } from './CommentaryItem';

interface Props {
  commentary: Commentary[];
  loading: boolean;
  error: string | null;
  matchStatus: MatchStatus;
}

export function CommentaryFeed({ commentary, loading, error, matchStatus }: Props) {
  return (
    <div className="flex flex-col flex-1 overflow-hidden">
      <div className="px-5 py-2.5 border-b border-gray-100 bg-gray-50">
        <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider">
          Commentary
        </h3>
      </div>

      <div className="overflow-y-auto flex-1">
        {loading && (
          <div className="px-5 py-6 text-sm text-gray-400 text-center">
            Loading commentary...
          </div>
        )}
        {error && (
          <div className="px-5 py-6 text-sm text-red-500 text-center">{error}</div>
        )}
        {!loading && !error && commentary.length === 0 && (
          <div className="px-5 py-6 text-sm text-center">
            {matchStatus === 'finished' ? (
              <p className="text-amber-500">
                Sorry, this site runs on a free API and the daily request limit has been reached.
                Commentary was not available for this match.
              </p>
            ) : (
              <p className="text-gray-400">No commentary yet.</p>
            )}
          </div>
        )}
        {commentary.map((entry) => (
          <CommentaryItem key={entry.id} entry={entry} />
        ))}
      </div>
    </div>
  );
}
