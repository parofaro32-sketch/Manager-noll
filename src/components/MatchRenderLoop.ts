import { GameEngine } from '../game/engine.ts';

let engine: GameEngine | null = null;
let canvas: HTMLCanvasElement | null = null;
let ctx: CanvasRenderingContext2D | null = null;
let raf: number | null = null;
let running = false;

const PITCH_W = 1050;
const PITCH_H = 680;

export function startRenderLoop(eng: GameEngine, cv: HTMLCanvasElement): void {
  engine = eng;
  canvas = cv;
  ctx = canvas.getContext('2d')!;
  running = true;
  renderFrame();
}

export function stopRenderLoop(): void {
  running = false;
  if (raf) cancelAnimationFrame(raf);
  raf = null;
}

function renderFrame(): void {
  if (!running || !engine || !ctx || !canvas) return;
  const match = engine.match;
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  const W = canvas.width / dpr;
  const H = canvas.height / dpr;

  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.clearRect(0, 0, W, H);

  drawPitch(ctx, W, H, match.camera);

  // Players
  for (const p of [...match.home.players, ...match.away.players]) {
    drawPlayer(ctx, p, match.camera, match.controlledPlayerId);
  }

  // Ball
  drawBall(ctx, match.ball, match.camera);

  raf = requestAnimationFrame(renderFrame);
}

function drawPitch(ctx: CanvasRenderingContext2D, W: number, H: number, camera: { x: number; y: number }): void {
  const cx = camera.x;
  const cy = camera.y;
  const grassA = '#0a2317';
  const grassB = '#071610';
  const chalk = 'rgba(210, 245, 225, 0.35)';
  const chalkBold = 'rgba(235, 255, 245, 0.75)';

  ctx.save();
  ctx.fillStyle = grassB;
  ctx.fillRect(0, 0, W, H);

  ctx.translate(W / 2 - cx, H / 2 - cy);

  // Stripes
  for (let i = -10; i < 20; i++) {
    ctx.fillStyle = i % 2 ? grassA : grassB;
    ctx.fillRect(i * 52.5, -200, 52.5, 400);
  }

  ctx.strokeStyle = chalk;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.rect(0, 0, PITCH_W, PITCH_H);
  ctx.moveTo(PITCH_W / 2, 0);
  ctx.lineTo(PITCH_W / 2, PITCH_H);
  ctx.arc(PITCH_W / 2, PITCH_H / 2, 90, 0, Math.PI * 2);
  ctx.rect(0, PITCH_H / 2 - 90, 160, 180);
  ctx.rect(PITCH_W - 160, PITCH_H / 2 - 90, 160, 180);
  ctx.rect(-14, PITCH_H / 2 - 36, 14, 72);
  ctx.rect(PITCH_W, PITCH_H / 2 - 36, 14, 72);
  ctx.stroke();

  ctx.strokeStyle = chalkBold;
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.arc(PITCH_W / 2, PITCH_H / 2, 4, 0, Math.PI * 2);
  ctx.fillStyle = chalkBold;
  ctx.fill();
  ctx.stroke();

  ctx.restore();
}

function drawPlayer(ctx: CanvasRenderingContext2D, p: any, camera: { x: number; y: number }, controlledId: string | null): void {
  const isControlled = p.id === controlledId;
  ctx.save();
  ctx.translate(p.pos.x - camera.x, p.pos.y - camera.y);
  ctx.beginPath();
  ctx.arc(0, 0, p.radius, 0, Math.PI * 2);
  ctx.fillStyle = p.team === 'home' ? '#22c55e' : '#38bdf8';
  ctx.strokeStyle = isControlled ? '#fbbf24' : 'rgba(0,0,0,0.5)';
  ctx.lineWidth = isControlled ? 3 : 1;
  ctx.fill();
  ctx.stroke();

  ctx.fillStyle = '#000';
  ctx.font = '10px sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(p.number, 0, 0);

  if (p.hasBall) {
    ctx.beginPath();
    ctx.arc(0, -p.radius - 6, 4, 0, Math.PI * 2);
    ctx.fillStyle = '#fbbf24';
    ctx.fill();
  }

  ctx.restore();
}

function drawBall(ctx: CanvasRenderingContext2D, ball: any, camera: { x: number; y: number }): void {
  ctx.save();
  ctx.translate(ball.pos.x - camera.x, ball.pos.y - camera.y);
  ctx.beginPath();
  ctx.arc(0, 0, ball.radius, 0, Math.PI * 2);
  ctx.fillStyle = '#facc15';
  ctx.fill();
  ctx.strokeStyle = 'rgba(0,0,0,0.6)';
  ctx.lineWidth = 1;
  ctx.stroke();
  ctx.restore();
}
