import type { Match } from '../types';
import { StatusBadge } from './StatusBadge';

interface Props {
  match: Match;
  commentaryOpen: boolean;
  onCommentaryToggle: () => void;
}

function formatDateTime(dt: string | null): string | null {
  if (!dt) return null;
  const d = new Date(dt);
  return d.toLocaleDateString([], { month: 'short', day: 'numeric' }) +
    ' · ' +
    d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

export function MatchCard({ match, commentaryOpen, onCommentaryToggle }: Props) {
  const time = formatDateTime(match.startTime);

  return (
    <div
      className={`bg-white border-[3px] border-black flex flex-col transition-shadow ${commentaryOpen
          ? 'shadow-[6px_6px_0px_#FAFF00]'
          : 'shadow-[6px_6px_0px_#000] hover:shadow-[3px_3px_0px_#000]'
        }`}
    >
      {/* Card header: sport / league / status */}
      <div className="border-b-[3px] border-black px-4 py-2.5 flex items-center justify-between gap-2 bg-[#F0EFEB]">
        <span className="text-xs font-black uppercase tracking-widest text-gray-600 truncate">
          {match.league ?? 'Football'}
        </span>
        <StatusBadge status={match.status} />
      </div>

      {/* Score section */}
      <div className="px-4 py-6 flex-1 flex flex-col justify-center">
        <div className="flex items-stretch gap-3">
          {/* Home, divider, away */}
          <div className="flex-1 text-center flex flex-col items-center justify-center gap-2">
            <p className="text-xs font-black uppercase tracking-wide text-gray-500 leading-tight line-clamp-2 w-full">
              {match.homeTeam}
            </p>
            <p className="text-6xl font-black tabular-nums leading-none text-black">
              {match.homeScore}
            </p>
          </div>

          <div className="flex flex-col items-center justify-center">
            <div className="w-px h-full bg-black opacity-20" />
            <span className="text-xl font-black text-gray-300 py-2 select-none">–</span>
            <div className="w-px h-full bg-black opacity-20" />
          </div>

          <div className="flex-1 text-center flex flex-col items-center justify-center gap-2">
            <p className="text-xs font-black uppercase tracking-wide text-gray-500 leading-tight line-clamp-2 w-full">
              {match.awayTeam}
            </p>
            <p className="text-6xl font-black tabular-nums leading-none text-black">
              {match.awayScore}
            </p>
          </div>
        </div>

        {/* Time row for non-live matches */}
        {time && match.status !== 'live' && (
          <p className="mt-4 text-center text-xs font-bold text-gray-400 uppercase tracking-widest">
            {time}
          </p>
        )}
      </div>

      <div className="border-t-[3px] border-black px-4 py-3">
        <button
          onClick={onCommentaryToggle}
          className={`w-full py-2.5 font-black text-xs uppercase tracking-[0.15em] border-2 border-black transition-all active:translate-y-px ${commentaryOpen
              ? 'bg-[#FAFF00] text-black shadow-none'
              : 'bg-black text-white hover:bg-[#FAFF00] hover:text-black shadow-[3px_3px_0px_#888] hover:shadow-none'
            }`}
        >
          {commentaryOpen ? '✕ Close Commentary' : 'Commentary'}
        </button>
      </div>
    </div>
  );
}
