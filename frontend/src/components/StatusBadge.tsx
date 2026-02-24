import type { MatchStatus } from '../types';

interface Props {
  status: MatchStatus;
}

const config: Record<MatchStatus, { label: string; classes: string; dot?: boolean }> = {
  live: {
    label: 'LIVE',
    classes: 'bg-green-100 text-green-700 border border-green-300',
    dot: true,
  },
  scheduled: {
    label: 'SCHEDULED',
    classes: 'bg-slate-100 text-slate-500 border border-slate-200',
  },
  finished: {
    label: 'FINISHED',
    classes: 'bg-gray-100 text-gray-400 border border-gray-200',
  },
};

export function StatusBadge({ status }: Props) {
  const { label, classes, dot } = config[status];
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-semibold tracking-wide ${classes}`}
    >
      {dot && (
        <span className="h-1.5 w-1.5 rounded-full bg-green-500 animate-pulse" />
      )}
      {label}
    </span>
  );
}
