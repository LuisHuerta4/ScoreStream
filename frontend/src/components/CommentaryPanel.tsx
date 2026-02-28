import type { Match } from '../types';
import { useMatchDetail } from '../hooks/useMatchDetail';
import { StatusBadge } from './StatusBadge';
import { CommentaryItem } from './CommentaryItem';

interface Props {
  match: Match;
  onClose: () => void;
}

export function CommentaryPanel({ match, onClose }: Props) {
  const { commentary, loading, error } = useMatchDetail(match.id);

  return (
    <div className="fixed right-0 top-0 h-screen z-50 w-full lg:w-[440px] flex flex-col bg-white border-l-[3px] border-black shadow-[-8px_0px_0px_#000] transition-transform duration-300">

      {/* Header */}
      <div className="bg-black text-white px-5 py-4 flex items-start justify-between gap-3 shrink-0 border-b-[3px] border-black">
        <div className="flex-1 min-w-0">
          <p className="text-xs font-black uppercase tracking-[0.25em] text-[#FAFF00] mb-1">
            {match.sport}{match.league ? ` · ${match.league}` : ''}
          </p>
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-sm font-black uppercase leading-tight text-white truncate">
              {match.homeTeam}
            </span>
            <span className="text-xs font-black text-gray-500">VS</span>
            <span className="text-sm font-black uppercase leading-tight text-white truncate">
              {match.awayTeam}
            </span>
          </div>
        </div>
        <button
          onClick={onClose}
          className="shrink-0 w-10 h-10 border-2 border-white flex items-center justify-center font-black text-base hover:bg-white hover:text-black transition-colors"
          aria-label="Close commentary"
        >
          ✕
        </button>
      </div>

      {/* Scoreboard */}
      <div className="bg-[#FAFF00] border-b-[3px] border-black px-5 py-5 shrink-0">
        <div className="flex items-center justify-between gap-4">
          <div className="flex-1 text-center">
            <p className="text-xs font-black uppercase tracking-wide text-gray-700 mb-2 truncate">
              {match.homeTeam}
            </p>
            <p className="text-6xl font-black tabular-nums leading-none text-black">
              {match.homeScore}
            </p>
          </div>

          <div className="flex flex-col items-center gap-2 shrink-0">
            <StatusBadge status={match.status} />
            <span className="text-2xl font-black text-gray-400 select-none">–</span>
          </div>

          <div className="flex-1 text-center">
            <p className="text-xs font-black uppercase tracking-wide text-gray-700 mb-2 truncate">
              {match.awayTeam}
            </p>
            <p className="text-6xl font-black tabular-nums leading-none text-black">
              {match.awayScore}
            </p>
          </div>
        </div>
      </div>

      {/* Commentary label */}
      <div className="bg-black px-5 py-2.5 shrink-0">
        <h3 className="text-xs font-black uppercase tracking-[0.3em] text-[#FAFF00]">
          Commentary
        </h3>
      </div>

      {/* Feed */}
      <div className="flex-1 overflow-y-auto commentary-scroll">
        {loading && (
          <div className="px-5 py-8 text-center">
            <p className="text-xs font-black uppercase tracking-widest text-gray-400">
              Loading...
            </p>
          </div>
        )}
        {error && (
          <div className="px-5 py-8 text-center border-2 border-black m-4 bg-[#FF3B30]/10">
            <p className="text-xs font-black uppercase tracking-widest text-[#FF3B30]">
              {error}
            </p>
          </div>
        )}
        {!loading && !error && commentary.length === 0 && (
          <div className="px-5 py-10 text-center">
            <p className="text-2xl font-black text-gray-200 uppercase mb-2">—</p>
            <p className="text-xs font-black uppercase tracking-widest text-gray-400">
              No commentary available
            </p>
          </div>
        )}
        {commentary.map((entry) => (
          <CommentaryItem key={entry.id} entry={entry} />
        ))}
      </div>
    </div>
  );
}
