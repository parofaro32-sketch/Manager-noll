import React, { useRef, useEffect, useCallback } from 'react';
import { GameEngine } from '../game/engine.ts';
import { KeyboardControls } from '../game/controls.ts';
import { startRenderLoop, stopRenderLoop } from './MatchRenderLoop.ts';
import { MatchState } from '../game/types.ts';

const PITCH_W = 1050;
const PITCH_H = 680;

export function MatchView(): React.ReactElement | null {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const engineRef = useRef<GameEngine | null>(null);
  const kbRef = useRef<KeyboardControls | null>(null);

  const resetMatch = useCallback(() => {
    const eng = engineRef.current;
    if (!eng) return;
    eng.reset();
  }, []);

  const togglePause = useCallback(() => {
    const eng = engineRef.current;
    if (!eng) return;
    if (eng.match.phase === 'ended') {
      eng.reset();
    } else if (eng.match.phase === 'kickoff') {
      // already playing, do nothing
    } else {
      eng.stop();
    }
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current!;
    const ctx = canvas.getContext('2d')!;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = PITCH_W * dpr;
    canvas.height = PITCH_H * dpr;
    canvas.style.width = `${PITCH_W}px`;
    canvas.style.height = `${PITCH_H}px`;

    const engine = new GameEngine({ pitchWidth: PITCH_W, pitchHeight: PITCH_H });
    engineRef.current = engine;
    const kb = new KeyboardControls(engine.input);
    kbRef.current = kb;
    kb.connect();
    engine.start();

    // Start render loop once canvas is ready
    startRenderLoop(engine, canvas);

    return () => {
      kb.disconnect();
      engine.stop();
      stopRenderLoop();
    };
  }, []);

  return (
    <div className="relative w-full h-[680px] bg-[#040806] overflow-hidden rounded-2xl border border-white/10 shadow-2xl">
      <canvas ref={canvasRef} className="block w-full h-full" />
      <div className="absolute inset-0 pointer-events-none flex flex-col">
        <Scoreboard match={engineRef.current?.match} />
      </div>
      <ControlsOverlay engine={engineRef.current} togglePause={togglePause} resetMatch={resetMatch} />
      <MobileControls input={engineRef.current?.input} />
    </div>
  );
}

function Scoreboard({ match }: { match: MatchState | null | undefined }): React.ReactElement | null {
  if (!match) return null;
  const mm = Math.floor(match.time / 60);
  const ss = Math.floor(match.time % 60);
  const timeStr = `${mm}:${ss.toString().padStart(2, '0')}`;
  return (
    <div className="absolute top-4 left-1/2 -translate-x-1/2 flex gap-8 items-center text-white font-display font-bold uppercase tracking-wider text-xl drop-shadow-md z-20">
      <div className="flex flex-col items-center">
        <span className="text-slate-400 text-xs">Home</span>
        <span className="text-2xl text-emerald-400">{match.homeScore}</span>
      </div>
      <div className="text-slate-500 text-xs">{timeStr} / {Math.floor(match.maxTime / 60)}:00</div>
      <div className="flex flex-col items-center">
        <span className="text-slate-400 text-xs">Away</span>
        <span className="text-2xl text-cyan-400">{match.awayScore}</span>
      </div>
    </div>
  );
}

function ControlsOverlay({
  engine,
  togglePause,
  resetMatch,
}: {
  engine: GameEngine | null;
  togglePause: () => void;
  resetMatch: () => void;
}): React.ReactElement | null {
  if (!engine) return null;
  const { match } = engine;
  const ended = match.phase === 'ended';
  const playing = match.phase === 'playing';

  if (ended) {
    const winner = match.winner === 'home' ? 'Home Wins!' : match.winner === 'away' ? 'Away Wins!' : 'Draw!';
    return (
      <div className="absolute inset-0 bg-black/75 flex flex-col items-center justify-center z-30 pointer-events-auto">
        <h2 className="text-4xl font-display font-black text-white uppercase drop-shadow-lg mb-2">
          Match Over
        </h2>
        <p className="text-2xl text-emerald-400 mb-1">{winner}</p>
        <p className="text-slate-300 text-xl mb-8">{match.homeScore} - {match.awayScore}</p>
        <button
          onClick={() => { resetMatch(); }}
          className="px-8 py-3 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-lg shadow-lg transition"
        >
          Play Again
        </button>
      </div>
    );
  }

  return (
    <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex gap-4 items-center z-30 pointer-events-auto">
      <button
        onClick={togglePause}
        className="px-6 py-2 bg-white/10 hover:bg-white/20 text-white font-bold rounded-full backdrop-blur border border-white/20 transition"
      >
        {playing ? 'Pause' : 'Resume'}
      </button>
    </div>
  );
}

function MobileControls({ input }: { input: any }): React.ReactElement | null {
  if (!input) return null;
  const [stick, setStick] = React.useState<{ x: number; y: number } | null>(null);
  const [touchId, setTouchId] = React.useState<number | null>(null);

  const btn = (label: string, onPress: () => void, onRelease: () => void) => (
    <button
      className="w-14 h-14 bg-white/10 border border-white/20 rounded-full text-white font-bold text-lg backdrop-blur active:scale-95 transition active:bg-white/20"
      onPointerDown={(e) => { e.preventDefault(); onPress(); }}
      onPointerUp={(e) => { e.preventDefault(); onRelease(); }}
      onPointerLeave={(e) => { e.preventDefault(); onRelease(); }}
    >
      {label}
    </button>
  );

  return (
    <div className="absolute bottom-4 left-4 right-4 flex flex-col gap-3 pointer-events-none z-30">
      <div className="flex justify-between items-end w-full px-4">
        <div className="relative w-32 h-32 pointer-events-auto bg-white/5 rounded-full border border-white/10 backdrop-blur">
          <div
            className="absolute w-14 h-14 bg-white/20 border border-white/30 rounded-full pointer-events-none"
            style={{
              transform: stick ? `translate(${stick.x - 16}px, ${stick.y - 16}px)` : 'translate(0,0)',
              left: stick ? stick.x : 16,
              top: stick ? stick.y : 16,
            }}
          />
          <div
            className="inset-0 pointer-events-auto"
            onPointerDown={(e) => {
              e.preventDefault();
              const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
              setTouchId(e.pointerId);
              setStick({ x: e.clientX - rect.left, y: e.clientY - rect.top });
            }}
            onPointerMove={(e) => {
              if (touchId === null || e.pointerId !== touchId) return;
              e.preventDefault();
              const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
              const x = Math.max(0, Math.min(32, e.clientX - rect.left));
              const y = Math.max(0, Math.min(32, e.clientY - rect.top));
              setStick({ x, y });
              const dx = x - 16;
              const dy = y - 16;
              input.up = dy < -6;
              input.down = dy > 6;
              input.left = dx < -6;
              input.right = dx > 6;
            }}
            onPointerUp={(e) => {
              if (touchId !== null && e.pointerId === touchId) {
                e.preventDefault();
                setTouchId(null);
                setStick(null);
                input.up = false; input.down = false; input.left = false; input.right = false;
              }
            }}
            onPointerLeave={(e) => {
              if (touchId !== null && e.pointerId === touchId) {
                e.preventDefault();
                setTouchId(null);
                setStick(null);
                input.up = false; input.down = false; input.left = false; input.right = false;
              }
            }}
          />
        </div>
        <div className="flex gap-2">
          {btn('Sprint', () => { input.sprint = true; }, () => { input.sprint = false; })}
          {btn('Pass', () => { input.pass = true; setTimeout(() => { input.pass = false; }, 120); }, () => {})}
          {btn('Shoot', () => { input.shoot = true; setTimeout(() => { input.shoot = false; }, 120); }, () => {})}
          {btn('Tackle', () => { input.tackle = true; setTimeout(() => { input.tackle = false; }, 120); }, () => {})}
          {btn('Switch', () => { input.switchPlayer = true; setTimeout(() => { input.switchPlayer = false; }, 120); }, () => {})}
        </div>
      </div>
    </div>
  );
}
