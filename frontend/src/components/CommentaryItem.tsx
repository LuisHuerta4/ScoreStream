import type { Commentary } from '../types';

interface Props {
  entry: Commentary;
}

const eventConfig: Record<string, { bg: string; label: string }> = {
  goal:          { bg: 'bg-[#4ADE80]', label: 'GOAL' },
  own_goal:      { bg: 'bg-[#FF3B30]', label: 'OWN GOAL' },
  yellow_card:   { bg: 'bg-[#FAFF00]', label: 'YELLOW' },
  red_card:      { bg: 'bg-[#FF3B30]', label: 'RED' },
  substitution:  { bg: 'bg-[#A5F3FC]', label: 'SUB' },
  penalty:       { bg: 'bg-[#FB923C]', label: 'PEN' },
  var:           { bg: 'bg-[#E5E7EB]', label: 'VAR' },
  status_change: { bg: 'bg-[#E5E7EB]', label: 'INFO' },
  kickoff:       { bg: 'bg-[#E5E7EB]', label: 'KO' },
  halftime:      { bg: 'bg-[#E5E7EB]', label: 'HT' },
  fulltime:      { bg: 'bg-[#E5E7EB]', label: 'FT' },
};

function getEventConfig(eventType: string | null) {
  if (!eventType) return null;
  return eventConfig[eventType.toLowerCase()] ?? { bg: 'bg-[#E5E7EB]', label: eventType.toUpperCase() };
}

export function CommentaryItem({ entry }: Props) {
  const evConf = getEventConfig(entry.eventType);

  return (
    <div className="flex gap-3 px-4 py-3 border-b-2 border-black last:border-b-0 hover:bg-[#FAFF00]/20 transition-colors">
      {/* Minute bubble */}
      <div className="w-10 shrink-0 flex flex-col items-center pt-0.5">
        {entry.minute !== null ? (
          <span className="inline-flex items-center justify-center w-9 h-9 border-2 border-black bg-black text-white font-black text-xs tabular-nums">
            {entry.minute}'
          </span>
        ) : (
          <span className="inline-flex items-center justify-center w-9 h-9 border-2 border-black bg-[#E5E7EB] text-gray-400 font-black text-xs">
            —
          </span>
        )}
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0 pt-1">
        <div className="flex flex-wrap items-center gap-1.5 mb-1">
          {evConf && (
            <span className={`inline-block px-2 py-0.5 border-2 border-black font-black text-xs uppercase tracking-wider ${evConf.bg}`}>
              {evConf.label}
            </span>
          )}
          {entry.actor && (
            <span className="text-xs font-black text-gray-800 uppercase tracking-wide">
              {entry.actor}
            </span>
          )}
          {entry.team && (
            <span className="text-xs font-bold text-gray-400 uppercase">
              ({entry.team})
            </span>
          )}
        </div>
        <p className="text-sm font-bold text-gray-800 leading-snug">{entry.message}</p>
      </div>
    </div>
  );
}
