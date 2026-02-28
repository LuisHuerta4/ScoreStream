import type { MatchStatus } from '../types';

interface Props {
  status: MatchStatus;
}

export function StatusBadge({ status }: Props) {
  if (status === 'live') {
    return (
      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-[#4ADE80] border-2 border-black font-black text-xs uppercase tracking-widest text-black">
        <span className="w-2 h-2 rounded-full bg-black animate-pulse" />
        LIVE
      </span>
    );
  }

  if (status === 'scheduled') {
    return (
      <span className="inline-flex items-center px-2.5 py-1 bg-[#A5F3FC] border-2 border-black font-black text-xs uppercase tracking-widest text-black">
        UPCOMING
      </span>
    );
  }

  return (
    <span className="inline-flex items-center px-2.5 py-1 bg-[#E5E7EB] border-2 border-black font-black text-xs uppercase tracking-widest text-gray-600">
      FT
    </span>
  );
}
