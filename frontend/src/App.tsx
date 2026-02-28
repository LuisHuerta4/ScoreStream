import { useState } from 'react';
import { useMatches } from './hooks/useMatches';
import { MatchCard } from './components/MatchCard';
import { CommentaryPanel } from './components/CommentaryPanel';
import type { MatchStatus } from './types';

type Tab = MatchStatus | 'all';

const TABS: { id: Tab; label: string }[] = [
  { id: 'live',      label: 'Live'      },
  { id: 'scheduled', label: 'Upcoming'  },
  { id: 'finished',  label: 'Finished'  },
  { id: 'all',       label: 'All'       },
];

export default function App() {
  const { matches, loading, error } = useMatches();
  const [activeTab, setActiveTab] = useState<Tab>('live');
  const [commentaryId, setCommentaryId] = useState<number | null>(null);

  const counts: Record<Tab, number> = {
    live:      matches.filter((m) => m.status === 'live').length,
    scheduled: matches.filter((m) => m.status === 'scheduled').length,
    finished:  matches.filter((m) => m.status === 'finished').length,
    all:       matches.length,
  };

  const filtered =
    activeTab === 'all' ? matches : matches.filter((m) => m.status === activeTab);

  const commentaryMatch = matches.find((m) => m.id === commentaryId) ?? null;

  function handleCommentaryToggle(id: number) {
    setCommentaryId((prev) => (prev === id ? null : id));
  }

  function handleTabChange(tab: Tab) {
    setActiveTab(tab);
    setCommentaryId(null);
  }

  return (
    <div className="min-h-screen bg-[#F0EFEB]">

      {/* Hero */}
      <header className="bg-black text-white px-6 sm:px-10 py-14 sm:py-20 border-b-[4px] border-black">
        <div className="max-w-7xl mx-auto">

          <div className="flex items-center gap-2.5 mb-5">
            <span className="w-2.5 h-2.5 rounded-full bg-[#4ADE80] animate-pulse" />
            <span className="text-xs font-black uppercase tracking-[0.35em] text-[#4ADE80]">
              Live Football
            </span>
          </div>

          <h1 className="text-6xl sm:text-8xl lg:text-9xl font-black uppercase leading-none tracking-tight">
            Score<span className="text-[#FAFF00]">Stream</span>
          </h1>

          <p className="mt-5 text-sm sm:text-base font-bold uppercase tracking-[0.2em] text-gray-400">
            Live scores &amp; commentary — no refresh needed
          </p>

          <div className="mt-8 flex flex-wrap gap-4">
            {counts.live > 0 && (
              <div className="inline-flex items-center gap-2 px-4 py-2 bg-[#4ADE80] border-2 border-[#4ADE80]">
                <span className="w-2 h-2 rounded-full bg-black animate-pulse" />
                <span className="text-xs font-black uppercase tracking-widest text-black">
                  {counts.live} Live Now
                </span>
              </div>
            )}
            <div className="inline-flex items-center gap-2 px-4 py-2 border-2 border-white/20">
              <span className="text-xs font-black uppercase tracking-widest text-gray-400">
                {counts.all} Matches Today
              </span>
            </div>
          </div>
        </div>
      </header>

      {/* Tabs */}
      <div className="sticky top-0 z-30 bg-[#F0EFEB] border-b-[3px] border-black">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex overflow-x-auto [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            {TABS.map((tab) => (
              <button
                key={tab.id}
                onClick={() => handleTabChange(tab.id)}
                className={`shrink-0 flex items-center gap-2 px-5 sm:px-6 py-4 font-black text-xs uppercase tracking-[0.15em] border-r-[3px] border-black transition-colors ${
                  activeTab === tab.id
                    ? 'bg-black text-white'
                    : 'bg-transparent text-black hover:bg-[#FAFF00]'
                }`}
              >
                {tab.label}
                <span
                  className={`inline-flex items-center justify-center min-w-[20px] h-5 px-1 border-2 text-[10px] font-black tabular-nums ${
                    activeTab === tab.id
                      ? 'border-white text-white'
                      : 'border-black text-black'
                  }`}
                >
                  {counts[tab.id]}
                </span>
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Main content (grid + panel) */}
      <div className={`transition-all duration-300 ${commentaryMatch ? 'lg:mr-[440px]' : ''}`}>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">

          {/* Loading */}
          {loading && (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
              {[1, 2, 3, 4, 5, 6].map((i) => (
                <div
                  key={i}
                  className="bg-white border-[3px] border-black shadow-[6px_6px_0px_#000] h-56 animate-pulse"
                />
              ))}
            </div>
          )}

          {!loading && error && (
            <div className="border-[3px] border-black bg-white p-8 shadow-[6px_6px_0px_#000] max-w-md">
              <p className="text-xs font-black uppercase tracking-widest text-[#FF3B30] mb-2">
                Error
              </p>
              <p className="font-bold text-gray-800">{error}</p>
            </div>
          )}

          {/* Empty state */}
          {!loading && !error && filtered.length === 0 && (
            <div className="border-[3px] border-black bg-white p-12 shadow-[6px_6px_0px_#000] text-center max-w-sm mx-auto">
              <p className="text-4xl font-black text-gray-200 mb-4">—</p>
              <p className="text-xs font-black uppercase tracking-[0.25em] text-gray-400">
                No {activeTab === 'all' ? '' : activeTab} matches right now
              </p>
            </div>
          )}

          {/* Cards grid */}
          {!loading && !error && filtered.length > 0 && (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
              {filtered.map((match) => (
                <MatchCard
                  key={match.id}
                  match={match}
                  commentaryOpen={commentaryId === match.id}
                  onCommentaryToggle={() => handleCommentaryToggle(match.id)}
                />
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Mobile/tablet backdrop */}
      {commentaryMatch && (
        <div
          className="fixed inset-0 bg-black/60 z-40 lg:hidden"
          onClick={() => setCommentaryId(null)}
        />
      )}

      {/* Commentary panel */}
      {commentaryMatch && (
        <CommentaryPanel
          match={commentaryMatch}
          onClose={() => setCommentaryId(null)}
        />
      )}
    </div>
  );
}