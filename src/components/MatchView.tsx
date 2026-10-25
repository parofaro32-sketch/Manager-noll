import React, { useRef, useEffect, useCallback, useState } from 'react';
import * as THREE from 'three';
import { GameEngine } from '../game/engine.ts';
import { KeyboardControls } from '../game/controls.ts';
import { MatchState } from '../game/types.ts';

const PITCH_W = 1050;
const PITCH_H = 680;

function isMobileDevice(): boolean {
  const ua = navigator.userAgent || navigator.platform || '';
  const uaMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(ua);
  const coarsePointer = window.matchMedia('(pointer: coarse)').matches;
  const smallScreen = window.innerWidth < 768;
  return uaMobile || coarsePointer || smallScreen;
}

export function MatchView(): React.ReactElement | null {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const engineRef = useRef<GameEngine | null>(null);
  const kbRef = useRef<KeyboardControls | null>(null);

  const sceneRef = useRef<THREE.Scene | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const playerMeshes = useRef<Map<string, THREE.Group>>(new Map());
  const ballMeshRef = useRef<THREE.Mesh | null>(null);
  const rafRef = useRef<number>(0);
  const [isMobile] = useState(isMobileDevice);

  const resetMatch = useCallback(() => {
    const eng = engineRef.current;
    if (eng) eng.reset();
  }, []);

  const togglePause = useCallback(() => {
    const eng = engineRef.current;
    if (!eng) return;
    if (eng.match.phase === 'ended') {
      eng.reset();
    }
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    canvas.style.display = 'block';
    canvas.style.width = '100%';
    canvas.style.height = '100%';

    const engine = new GameEngine({ pitchWidth: PITCH_W, pitchHeight: PITCH_H });
    engineRef.current = engine;
    const kb = new KeyboardControls(engine.input);
    kbRef.current = kb;
    kb.connect();

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x020503);
    scene.fog = new THREE.Fog(0x020503, 300, 1100);
    sceneRef.current = scene;

    const camera = new THREE.PerspectiveCamera(55, PITCH_W / PITCH_H, 0.1, 2000);
    camera.position.set(525, 560, 700);
    camera.lookAt(525, 0, 340);
    cameraRef.current = camera;

    const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    renderer.setSize(PITCH_W, PITCH_H);
    renderer.setPixelRatio(dpr);
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    rendererRef.current = renderer;

    // Lights
    const hemi = new THREE.HemisphereLight(0x88cc88, 0x222233, 0.7);
    scene.add(hemi);
    const ambient = new THREE.AmbientLight(0xffffff, 0.5);
    scene.add(ambient);
    const dirLight = new THREE.DirectionalLight(0xffffff, 1.0);
    dirLight.position.set(200, 450, 150);
    dirLight.castShadow = true;
    dirLight.shadow.mapSize.width = 2048;
    dirLight.shadow.mapSize.height = 2048;
    dirLight.shadow.camera.left = -400;
    dirLight.shadow.camera.right = 400;
    dirLight.shadow.camera.top = 400;
    dirLight.shadow.camera.bottom = -400;
    dirLight.shadow.camera.near = 1;
    dirLight.shadow.camera.far = 1000;
    scene.add(dirLight);

    // Pitch plane — centered at middle of play area (525, 0, 340)
    const pitchGeo = new THREE.PlaneGeometry(PITCH_W, PITCH_H);
    pitchGeo.rotateX(-Math.PI / 2);
    const pitch = new THREE.Mesh(
      pitchGeo,
      new THREE.MeshStandardMaterial({ color: 0x0d2b1c })
    );
    pitch.position.set(PITCH_W / 2, 0, PITCH_H / 2);
    pitch.receiveShadow = true;
    scene.add(pitch);

    // Grass stripe variation
    const stripeGeo = new THREE.PlaneGeometry(PITCH_W, PITCH_H);
    stripeGeo.rotateX(-Math.PI / 2);
    const stripeMat = new THREE.MeshStandardMaterial({
      color: 0x081e14,
      transparent: true,
      opacity: 0.5,
    });
    const stripes = new THREE.Mesh(stripeGeo, stripeMat);
    stripes.position.set(PITCH_W / 2, 0.02, PITCH_H / 2);
    scene.add(stripes);

    // Pitch markings
    const lineMat = new THREE.MeshBasicMaterial({
      color: 0xffffff,
      transparent: true,
      opacity: 0.5,
    });
    const addLine = (x: number, z: number, w: number, h: number) => {
      const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), lineMat);
      m.position.set(x, 0.06, z);
      m.rotation.x = -Math.PI / 2;
      m.receiveShadow = true;
      scene.add(m);
    };
    addLine(PITCH_W / 2, 0, PITCH_W, 4);
    addLine(PITCH_W / 2, PITCH_H, PITCH_W, 4);
    addLine(0, PITCH_H / 2, 4, PITCH_H);
    addLine(PITCH_W, PITCH_H / 2, 4, PITCH_H);
    addLine(PITCH_W / 2, PITCH_H / 2, 4, PITCH_H);
    addLine(80, PITCH_H / 2, 160, 180);
    addLine(PITCH_W - 80, PITCH_H / 2, 160, 180);

    // Center circle
    const curve = new THREE.EllipseCurve(
      PITCH_W / 2,
      PITCH_H / 2,
      90,
      90,
      0,
      2 * Math.PI,
      false,
      0
    );
    const circlePts = curve.getPoints(64);
    const circleGeo = new THREE.BufferGeometry().setFromPoints(
      circlePts.map((p: THREE.Vector2) => new THREE.Vector3(p.x, 0.065, p.y))
    );
    const circleLine = new THREE.LineLoop(circleGeo, lineMat);
    scene.add(circleLine);

    // Center spot
    const centerSpot = new THREE.Mesh(
      new THREE.CircleGeometry(2, 16),
      new THREE.MeshBasicMaterial({ color: 0xffffff })
    );
    centerSpot.position.set(PITCH_W / 2, 0.07, PITCH_H / 2);
    centerSpot.rotation.x = -Math.PI / 2;
    scene.add(centerSpot);

    // Goals
    const goalMat = new THREE.MeshStandardMaterial({
      color: 0xffffff,
      transparent: true,
      opacity: 0.4,
    });
    const goalBox = new THREE.BoxGeometry(16, 7, 74);
    const goalHome = new THREE.Mesh(goalBox, goalMat);
    goalHome.position.set(PITCH_W + 8, 3.5, PITCH_H / 2);
    scene.add(goalHome);
    const goalAway = goalHome.clone();
    goalAway.position.set(-8, 3.5, PITCH_H / 2);
    scene.add(goalAway);

    // Goal nets
    const netMat = new THREE.MeshBasicMaterial({
      color: 0xffffff,
      transparent: true,
      opacity: 0.18,
      wireframe: true,
    });
    const netGeo = new THREE.BoxGeometry(16, 7, 74);
    const netHome = new THREE.Mesh(netGeo, netMat);
    netHome.position.set(PITCH_W + 8, 3.5, PITCH_H / 2);
    scene.add(netHome);
    const netAway = netHome.clone();
    netAway.position.set(-8, 3.5, PITCH_H / 2);
    scene.add(netAway);

    // Helper: build a 3D player mesh
    const buildPlayerMesh = (teamColor: number) => {
      const group = new THREE.Group();

      const body = new THREE.Mesh(
        new THREE.CylinderGeometry(0.8, 0.8, 1.8, 14),
        new THREE.MeshStandardMaterial({ color: teamColor })
      );
      body.position.y = 0.9;
      body.castShadow = true;
      body.receiveShadow = true;
      group.add(body);

      const head = new THREE.Mesh(
        new THREE.SphereGeometry(0.55, 12, 12),
        new THREE.MeshStandardMaterial({ color: 0xe8e8e8 })
      );
      head.position.y = 2.05;
      head.castShadow = true;
      group.add(head);

      const tag = new THREE.Mesh(
        new THREE.RingGeometry(0.55, 0.75, 12),
        new THREE.MeshBasicMaterial({ color: 0xffffff })
      );
      tag.position.y = 2.65;
      tag.rotation.x = -Math.PI / 2;
      group.add(tag);

      return group;
    };

    const allPlayers = [
      ...engine.match.home.players,
      ...engine.match.away.players,
    ];
    allPlayers.forEach((p) => {
      const mesh = buildPlayerMesh(
        p.team === 'home' ? 0x22c55e : 0x38bdf8
      );
      mesh.position.set(p.pos.x, 0, p.pos.y);
      mesh.rotation.y = p.direction;
      mesh.castShadow = true;
      scene.add(mesh);
      playerMeshes.current.set(p.id, mesh);
    });

    // Ball
    const ballMesh = new THREE.Mesh(
      new THREE.SphereGeometry(0.75, 20, 20),
      new THREE.MeshStandardMaterial({ color: 0xfacc15 })
    );
    ballMesh.position.set(
      engine.match.ball.pos.x,
      0.75,
      engine.match.ball.pos.y
    );
    ballMesh.castShadow = true;
    scene.add(ballMesh);
    ballMeshRef.current = ballMesh;

    // Resize
    const onResize = () => {
      const cam = cameraRef.current;
      const ren = rendererRef.current;
      if (!cam || !ren) return;
      cam.aspect = PITCH_W / PITCH_H;
      cam.updateProjectionMatrix();
      ren.setSize(PITCH_W, PITCH_H);
    };
    window.addEventListener('resize', onResize);

    // Single game loop: update logic + render
    let last = performance.now();
    const tick = () => {
      const eng = engineRef.current;
      const cam = cameraRef.current;
      const ren = rendererRef.current;
      const scn = sceneRef.current;
      if (!eng || !cam || !ren || !scn) return;

      const now = performance.now();
      const dt = Math.min((now - last) / 1000, 0.1);
      last = now;

      eng.tick();

      const match = eng.match;

      // Update player meshes
      for (const p of [...match.home.players, ...match.away.players]) {
        const mesh = playerMeshes.current.get(p.id);
        if (!mesh) continue;
        mesh.position.set(p.pos.x, 0, p.pos.y);
        mesh.rotation.y = p.direction;
        const body = mesh.children[0] as THREE.Mesh;
        const mat = body.material as THREE.MeshStandardMaterial;
        const isControlled = p.id === match.controlledPlayerId;
        mat.color.setHex(
          isControlled
            ? 0xfbbf24
            : p.team === 'home'
              ? 0x22c55e
              : 0x38bdf8
        );
        const bob = Math.sin(now * 0.008) * 0.06;
        mesh.position.y = bob;
      }

      // Update ball
      const b = ballMeshRef.current;
      if (b) {
        b.position.set(match.ball.pos.x, 0.75, match.ball.pos.y);
      }

      // Camera follow the ball
      cam.position.x = THREE.MathUtils.lerp(cam.position.x, match.ball.pos.x, 0.1);
      cam.position.z = THREE.MathUtils.lerp(cam.position.z, match.ball.pos.y + 600, 0.1);
      cam.position.y = THREE.MathUtils.lerp(cam.position.y, 560, 0.1);
      cam.lookAt(match.ball.pos.x, 0, match.ball.pos.y);

      ren.render(scn, cam);
      rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);

    return () => {
      kb.disconnect();
      cancelAnimationFrame(rafRef.current);
      window.removeEventListener('resize', onResize);
      rendererRef.current?.dispose();
    };
  }, []);

  const match = engineRef.current?.match;
  if (!match) return null;

  return (
    <div className="relative w-full h-[680px] bg-[#020503] overflow-hidden rounded-2xl border border-white/10 shadow-2xl">
      <canvas ref={canvasRef} className="block w-full h-full" />
      <Scoreboard match={match} />
      <ControlsOverlay
        engine={engineRef.current}
        togglePause={togglePause}
        resetMatch={resetMatch}
      />
      {isMobile && <MobileControls input={engineRef.current?.input} />}
    </div>
  );
}

function Scoreboard({ match }: { match: MatchState }): React.ReactElement | null {
  const mm = Math.floor(match.time / 60);
  const ss = Math.floor(match.time % 60);
  const timeStr = `${mm}:${ss.toString().padStart(2, '0')}`;
  return (
    <div className="absolute top-4 left-1/2 -translate-x-1/2 flex gap-8 items-center text-white font-display font-bold uppercase tracking-wider text-xl drop-shadow-md z-20 pointer-events-none">
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

  if (ended) {
    const winner =
      match.winner === 'home'
        ? 'Home Wins!'
        : match.winner === 'away'
          ? 'Away Wins!'
          : 'Draw!';
    return (
      <div className="absolute inset-0 bg-black/75 flex flex-col items-center justify-center z-30 pointer-events-auto">
        <h2 className="text-4xl font-display font-black text-white uppercase drop-shadow-lg mb-2">
          Match Over
        </h2>
        <p className="text-2xl text-emerald-400 mb-1">{winner}</p>
        <p className="text-slate-300 text-xl mb-8">{match.homeScore} - {match.awayScore}</p>
        <button
          onClick={() => resetMatch()}
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
        {match.phase === 'playing' ? 'Pause' : 'Resume'}
      </button>
    </div>
  );
}

function MobileControls({ input }: { input: any }): React.ReactElement | null {
  if (!input) return null;
  const [stick, setStick] = useState<{ x: number; y: number } | null>(null);
  const [touchId, setTouchId] = useState<number | null>(null);

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
