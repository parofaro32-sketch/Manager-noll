import React, { useState } from 'react';
import { MatchView } from './components/MatchView.tsx';

type View = 'start' | 'match' | 'result';

export default function App(): React.ReactElement {
  const [view, setView] = useState<View>('start');

  return (
    <div className="min-h-screen w-full bg-[#040806] text-slate-100 font-sans">
      {view === 'start' && (
        <div className="min-h-screen flex flex-col items-center justify-center p-6">
          <div className="text-center">
            <h1 className="text-6xl font-display font-black text-white uppercase tracking-tighter drop-shadow-lg mb-2">
              Football Tops
            </h1>
            <p className="text-slate-400 text-lg mb-10">
              11v11 Football Match — Base Game
            </p>
            <button
              onClick={() => setView('match')}
              className="px-10 py-4 bg-emerald-600 hover:bg-emerald-500 text-white font-display font-bold text-xl uppercase rounded-full shadow-[0_0_30px_rgba(34,197,94,0.4)] transition"
            >
              Play Against Bots
            </button>
          </div>
        </div>
      )}

      {view === 'match' && (
        <div className="min-h-screen flex items-center justify-center p-4">
          <MatchView />
        </div>
      )}

      {view === 'result' && (
        <div className="min-h-screen flex flex-col items-center justify-center p-6 text-center">
          <h2 className="text-5xl font-display font-black text-white uppercase mb-4">Match Over</h2>
          <button
            onClick={() => setView('start')}
            className="px-10 py-4 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-full transition"
          >
            Back to Menu
          </button>
        </div>
      )}
    </div>
  );
}
