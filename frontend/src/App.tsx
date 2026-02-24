import { useState } from 'react';
import { useMatches } from './hooks/useMatches';
import { MatchList } from './components/MatchList';
import { MatchDetail } from './components/MatchDetail';

function App() {
  const { matches, loading, error } = useMatches();
  const [selectedId, setSelectedId] = useState<number | null>(null);

  const selectedMatch = matches.find((m) => m.id === selectedId) ?? null;

  return (
    <div className="flex flex-col h-screen bg-gray-50">
      <header className="shrink-0 bg-white border-b border-gray-200 px-5 py-3 flex items-center gap-3">
        <div className="flex items-center gap-2">
          <span className="text-lg font-bold text-gray-900 tracking-tight">ScoreStream</span>
          <span className="text-xs font-medium text-gray-400 bg-gray-100 px-2 py-0.5 rounded-full">
            LIVE
          </span>
        </div>
      </header>

      <div className="flex flex-1 overflow-hidden">
        <MatchList
          matches={matches}
          selectedId={selectedId}
          loading={loading}
          error={error}
          onSelect={setSelectedId}
        />

        <main className="flex flex-1 overflow-hidden bg-white">
          {selectedMatch ? (
            <MatchDetail match={selectedMatch} />
          ) : (
            <div className="flex flex-1 items-center justify-center text-sm text-gray-400">
              Select a match to view details
            </div>
          )}
        </main>
      </div>
    </div>
  );
}

export default App;
