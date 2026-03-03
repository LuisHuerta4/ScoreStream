import { useState } from 'react';
import type { Match, MatchStats } from '../types';
import { useMatchDetail } from '../hooks/useMatchDetail';
import { StatusBadge } from './StatusBadge';
import { CommentaryItem } from './CommentaryItem';

interface Props {
  match: Match;
  onClose: () => void;
}

const STAT_ROWS: { key: keyof MatchStats['home']; label: string }[] = [
  { key: 'possession',   label: 'Possession' },
  { key: 'shotsOnGoal',  label: 'Shots on Goal' },
  { key: 'totalShots',   label: 'Total Shots' },
  { key: 'corners',      label: 'Corners' },
  { key: 'fouls',        label: 'Fouls' },
  { key: 'yellowCards',  label: 'Yellow Cards' },
  { key: 'redCards',     label: 'Red Cards' },
  { key: 'offsides',     label: 'Offsides' },
  { key: 'passAccuracy', label: 'Pass Accuracy' },
];

function PossessionBar({ home, away }: { home: string; away: string }) {
  const homePct = parseInt(home, 10) || 50;
  const awayPct = parseInt(away, 10) || 50;
  return (
    <div className="flex h-3 border-2 border-black overflow-hidden mt-1">
      <div className="bg-black transition-all duration-500" style={{ width: `${homePct}%` }} />
      <div className="bg-[#FAFF00] transition-all duration-500" style={{ width: `${awayPct}%` }} />
    </div>
  );
}

function StatsPanel({ stats, homeTeam, awayTeam }: { stats: MatchStats; homeTeam: string; awayTeam: string }) {
  return (
    <div className="flex-1 overflow-y-auto commentary-scroll">
      {/* Team headers */}
      <div className="flex items-center border-b-[3px] border-black">
        <div className="flex-1 px-4 py-3 text-center border-r-2 border-black">
          <p className="text-[10px] font-black uppercase tracking-widest text-gray-500 truncate">{homeTeam}</p>
        </div>
        <div className="w-24 shrink-0 px-2 py-3 text-center">
          <p className="text-[9px] font-black uppercase tracking-widest text-gray-400">Stat</p>
        </div>
        <div className="flex-1 px-4 py-3 text-center border-l-2 border-black">
          <p className="text-[10px] font-black uppercase tracking-widest text-gray-500 truncate">{awayTeam}</p>
        </div>
      </div>

      {STAT_ROWS.map(({ key, label }) => {
        const homeVal = stats.home[key];
        const awayVal = stats.away[key];
        if (homeVal == null && awayVal == null) return null;

        const displayHome = homeVal ?? '—';
        const displayAway = awayVal ?? '—';

        return (
          <div key={key} className="border-b-2 border-black/10">
            {key === 'possession' ? (
              <div className="px-4 py-3">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-base font-black tabular-nums">{displayHome}</span>
                  <span className="text-[9px] font-black uppercase tracking-widest text-gray-500 px-2">{label}</span>
                  <span className="text-base font-black tabular-nums">{displayAway}</span>
                </div>
                <PossessionBar
                  home={String(homeVal ?? '50')}
                  away={String(awayVal ?? '50')}
                />
              </div>
            ) : (
              <div className="flex items-center">
                <div className="flex-1 px-4 py-3 text-center border-r-2 border-black/10">
                  <span className="text-xl font-black tabular-nums">{displayHome}</span>
                </div>
                <div className="w-24 shrink-0 px-2 py-3 text-center">
                  <span className="text-[9px] font-black uppercase tracking-widest text-gray-500 leading-tight block">{label}</span>
                </div>
                <div className="flex-1 px-4 py-3 text-center border-l-2 border-black/10">
                  <span className="text-xl font-black tabular-nums">{displayAway}</span>
                </div>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

export function CommentaryPanel({ match, onClose }: Props) {
  const { commentary, loading, error } = useMatchDetail(match.id);
  const [activeTab, setActiveTab] = useState<'commentary' | 'stats'>('commentary');

  const hasStats = match.stats !== null && match.stats !== undefined;

  return (
    <div className="fixed right-0 top-0 h-screen z-50 w-full lg:w-110 flex flex-col bg-white border-l-[3px] border-black shadow-[-8px_0px_0px_#000] transition-transform duration-300">

      {/* Header */}
      <div className="bg-black text-white px-5 py-4 flex items-start justify-between gap-3 shrink-0 border-b-[3px] border-black">
        <div className="flex-1 min-w-0">
          <p className="text-xs font-black uppercase tracking-[0.25em] text-[#FAFF00] mb-1">
            {match.league ?? 'Football'}
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
          aria-label="Close panel"
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

      {/* Tabs */}
      <div className="flex border-b-[3px] border-black shrink-0">
        <button
          onClick={() => setActiveTab('commentary')}
          className={`flex-1 py-2.5 text-xs font-black uppercase tracking-[0.2em] transition-colors border-r-2 border-black ${
            activeTab === 'commentary'
              ? 'bg-black text-[#FAFF00]'
              : 'bg-white text-black hover:bg-[#FAFF00]'
          }`}
        >
          Commentary
        </button>
        <button
          onClick={() => setActiveTab('stats')}
          className={`flex-1 py-2.5 text-xs font-black uppercase tracking-[0.2em] transition-colors ${
            activeTab === 'stats'
              ? 'bg-black text-[#FAFF00]'
              : 'bg-white text-black hover:bg-[#FAFF00]'
          }`}
        >
          Stats
        </button>
      </div>

      {/* Content */}
      {activeTab === 'commentary' && (
        <div className="flex-1 overflow-y-auto commentary-scroll">
          {loading && (
            <div className="px-5 py-8 text-center">
              <p className="text-xs font-black uppercase tracking-widest text-gray-400">Loading...</p>
            </div>
          )}
          {error && (
            <div className="px-5 py-8 text-center border-2 border-black m-4 bg-[#FF3B30]/10">
              <p className="text-xs font-black uppercase tracking-widest text-[#FF3B30]">{error}</p>
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
      )}

      {activeTab === 'stats' && (
        hasStats ? (
          <StatsPanel
            stats={match.stats!}
            homeTeam={match.homeTeam}
            awayTeam={match.awayTeam}
          />
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center px-5 py-10 text-center">
            <p className="text-2xl font-black text-gray-200 uppercase mb-2">—</p>
            <p className="text-xs font-black uppercase tracking-widest text-gray-400">
              {match.status === 'scheduled'
                ? 'Stats available once match kicks off'
                : 'No stats available for this match'}
            </p>
          </div>
        )
      )}
    </div>
  );
}