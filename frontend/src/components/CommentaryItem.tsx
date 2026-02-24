import type { Commentary } from '../types';

interface Props {
  entry: Commentary;
}

const eventColors: Record<string, string> = {
  goal: 'bg-green-100 text-green-700',
  yellow_card: 'bg-yellow-100 text-yellow-700',
  red_card: 'bg-red-100 text-red-700',
  substitution: 'bg-blue-100 text-blue-700',
  penalty: 'bg-orange-100 text-orange-700',
  kickoff: 'bg-slate-100 text-slate-600',
  halftime: 'bg-slate-100 text-slate-600',
  fulltime: 'bg-slate-100 text-slate-600',
};

function eventChipClass(eventType: string | null): string {
  if (!eventType) return 'bg-gray-100 text-gray-500';
  return eventColors[eventType.toLowerCase()] ?? 'bg-gray-100 text-gray-500';
}

function formatEventType(eventType: string): string {
  return eventType.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}

export function CommentaryItem({ entry }: Props) {
  return (
    <div className="flex gap-3 px-5 py-3 border-b border-gray-100 hover:bg-gray-50 transition-colors">
      {/* Minute */}
      <div className="w-10 shrink-0 text-right">
        {entry.minute !== null ? (
          <span className="text-xs font-bold text-gray-400 tabular-nums">
            {entry.minute}'
          </span>
        ) : (
          <span className="text-xs text-gray-300">—</span>
        )}
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0">
        <div className="flex flex-wrap items-center gap-1.5 mb-0.5">
          {entry.eventType && (
            <span
              className={`text-xs font-semibold px-1.5 py-0.5 rounded ${eventChipClass(entry.eventType)}`}
            >
              {formatEventType(entry.eventType)}
            </span>
          )}
          {entry.actor && (
            <span className="text-xs font-medium text-gray-600">{entry.actor}</span>
          )}
          {entry.team && (
            <span className="text-xs text-gray-400">({entry.team})</span>
          )}
        </div>
        <p className="text-sm text-gray-700 leading-snug">{entry.message}</p>
      </div>
    </div>
  );
}
