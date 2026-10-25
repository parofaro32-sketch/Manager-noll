import {
  Player,
  Team,
  TeamId,
  Ball,
  Vector,
  MatchState,
  InputState,
  GameConfig,
  AIState,
} from './types.ts';
import { updatePlayer } from './player.ts';
import { updateBall, dribbleBall, releaseBall, setBallPossession, isBallKickable, kickBall, createBall } from './ball.ts';
import { updateAI } from './ai.ts';
import { dist, createPitch, isBallInGoal } from './pitch.ts';
import {
  startKickoff,
  scoreGoal,
  restartAfterGoal,
  resetPositions,
  updateMatchTime,
  checkOutOfBounds,
  getPlayerById,
  getOpponentTeam,
  updateControlledPlayer,
} from './referee.ts';

const DEFAULT_CONFIG: GameConfig = {
  pitchWidth: 1050,
  pitchHeight: 680,
  matchTime: 180,
  playerSpeed: 110,
  playerSprintSpeed: 170,
  playerRadius: 10,
  ballRadius: 7,
  ballSpeed: 420,
  passSpeed: 320,
  shootSpeed: 520,
  tackleRadius: 26,
  kickableRadius: 42,
  aiReactionDelay: 0,
  gkSpeed: 90,
  dt: 1 / 60,
};

export function createMatch(config: Partial<GameConfig> = {}): MatchState {
  const cfg = { ...DEFAULT_CONFIG, ...config };
  const pitchWidth = cfg.pitchWidth;
  const pitchHeight = cfg.pitchHeight;

  const home = createTeam('home', 'Home FC', '#22c55e', 1, pitchWidth, pitchHeight);
  const away = createTeam('away', 'Away United', '#38bdf8', -1, pitchWidth, pitchHeight);

  const ball = createBall(pitchWidth / 2, pitchHeight / 2);

  const match: MatchState = {
    phase: 'kickoff',
    time: 0,
    maxTime: cfg.matchTime,
    homeScore: 0,
    awayScore: 0,
    kickoffTeam: 'home',
    ball,
    home,
    away,
    controlledPlayerId: home.players[0].id,
    camera: { x: pitchWidth / 2, y: pitchHeight / 2 },
    winner: null,
  };

  startKickoff(match, pitchWidth, pitchHeight);
  return match;
}

function createTeam(
  id: TeamId,
  name: string,
  color: string,
  attackDir: number,
  pitchWidth: number,
  pitchHeight: number
): Team {
  const roles: Array<{ role: any; number: number; name: string }> = [
    { role: 'GK', number: 1, name: 'Keeper' },
    { role: 'LB', number: 2, name: 'Left Back' },
    { role: 'CB', number: 3, name: 'Center Back 1' },
    { role: 'CB', number: 4, name: 'Center Back 2' },
    { role: 'RB', number: 5, name: 'Right Back' },
    { role: 'CDM', number: 6, name: 'Defensive Mid' },
    { role: 'CM', number: 7, name: 'Center Mid 1' },
    { role: 'CM', number: 8, name: 'Center Mid 2' },
    { role: 'LM', number: 11, name: 'Left Mid' },
    { role: 'RM', number: 10, name: 'Right Mid' },
    { role: 'ST', number: 9, name: 'Striker' },
  ];

  const players = roles.map((r, i) => ({
    id: `${id}_${i}`,
    team: id,
    role: r.role,
    number: r.number,
    name: `${name} ${r.number}`,
    pos: { x: 0, y: 0 },
    vel: { x: 0, y: 0 },
    target: { x: 0, y: 0 },
    radius: 10,
    speed: 110,
    sprintSpeed: 170,
    stamina: 100,
    attributes: { pace: 70, shooting: 70, passing: 70, dribbling: 70, defending: 70, physical: 70 },
    aiState: 'defending' as AIState,
    hasBall: false,
    controlTimer: 0,
    direction: attackDir === 1 ? 0 : Math.PI,
  }));

  // Set proper positions using percentage template
  const POS_TEMPLATE: Record<string, { x: number; y: number }> = {
    GK: { x: 50, y: 88 }, LB: { x: 15, y: 70 }, CB: { x: 38, y: 72 }, RB: { x: 85, y: 70 },
    CDM: { x: 50, y: 58 }, CM: { x: 38, y: 48 }, LM: { x: 15, y: 45 }, RM: { x: 85, y: 45 },
    CAM: { x: 50, y: 35 }, ST: { x: 50, y: 18 }, LW: { x: 22, y: 22 }, RW: { x: 78, y: 22 },
  };

  players.forEach((p) => {
    const base = POS_TEMPLATE[p.role] || { x: 50, y: 50 };
    let x = (base.x / 100) * pitchWidth;
    let y = (base.y / 100) * pitchHeight;
    if (attackDir === -1) {
      x = pitchWidth - x;
      y = pitchHeight - y;
    }
    p.pos = { x, y };
    p.target = { x, y };
  });

  const goal = id === 'home' ? { x: pitchWidth, y: pitchHeight / 2 } : { x: 0, y: pitchHeight / 2 };

  return {
    id,
    name,
    color,
    score: 0,
    players,
    goal,
    attackDir,
  };
}

export class GameEngine {
  match: MatchState;
  input: InputState;
  config: GameConfig;
  private lastTime: number;
  private animId: number | null = null;
  private running = false;
  private pulseCooldown = 0;
  private tackleCooldown = 0;
  private goalRestartTimer = 0;

  constructor(config: Partial<GameConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.match = createMatch(this.config);
    this.input = {
      up: false, down: false, left: false, right: false,
      sprint: false, pass: false, shoot: false, tackle: false, switchPlayer: false,
    };
    this.lastTime = performance.now();
  }

  start(): void {
    if (this.running) return;
    this.running = true;
    this.lastTime = performance.now();
    this.loop();
  }

  stop(): void {
    this.running = false;
    if (this.animId) cancelAnimationFrame(this.animId);
  }

  reset(): void {
    this.stop();
    this.match = createMatch(this.config);
    this.lastTime = performance.now();
    this.running = true;
    this.loop();
  }

  setInput(input: Partial<InputState>): void {
    Object.assign(this.input, input);
  }

  private loop(): void {
    if (!this.running) return;
    const now = performance.now();
    let dt = (now - this.lastTime) / 1000;
    this.lastTime = now;
    dt = Math.min(dt, 0.1);

    this.update(dt);
    this.animId = requestAnimationFrame(() => this.loop());
  }

  private update(dt: number): void {
    const { match, config, input } = this;
    const { home, away, ball } = match;
    const { pitchWidth, pitchHeight, playerRadius, kickableRadius, tackleRadius, ballSpeed, passSpeed, shootSpeed } = config;

    // Reduce cooldowns
    if (this.pulseCooldown > 0) this.pulseCooldown -= dt * 1000;
    if (this.tackleCooldown > 0) this.tackleCooldown -= dt * 1000;

    // Player switching (pulse)
    if (input.switchPlayer && this.pulseCooldown <= 0) {
      const team = match.controlledPlayerId
        ? getPlayerById(match, match.controlledPlayerId)?.team || 'home'
        : 'home';
      const players = team === 'home' ? home.players : away.players;
      let nearest: Player | null = null;
      let nearestD = 1e9;
      for (const p of players) {
        const d = dist(p.pos, ball.pos);
        if (d < nearestD) {
          nearestD = d;
          nearest = p;
        }
      }
      if (nearest) {
        match.controlledPlayerId = nearest.id;
        this.pulseCooldown = 400;
      }
    }

    // --- Controlled player ---
    const controlled = match.controlledPlayerId ? getPlayerById(match, match.controlledPlayerId) : null;
    if (controlled && match.phase === 'playing') {
      const move = inputToVector(input);
      updatePlayer(
        controlled,
        { ax: move.x, ay: move.y, sprint: input.sprint },
        dt,
        pitchWidth,
        pitchHeight
      );

      // Ball possession / dribble
      if (isBallKickable(ball, controlled.pos, kickableRadius) && ball.ownerTeam !== controlled.team) {
        // Take possession
        ball.owner = controlled.id;
        ball.ownerTeam = controlled.team;
        ball.kickable = false;
        controlled.hasBall = true;
      }

      if (controlled.hasBall || ball.owner === controlled.id) {
        controlled.hasBall = true;
        dribbleBall(ball, controlled, dt);
      }

      // Shoot
      if (input.shoot && this.pulseCooldown <= 0 && controlled.hasBall) {
        const dir = { x: Math.cos(controlled.direction), y: Math.sin(controlled.direction) };
        const toGoal = {
          x: match.kickoffTeam === 'home' ? pitchWidth : 0,
          y: pitchHeight / 2,
        };
        const shootDir = normalizeVec({ x: toGoal.x - controlled.pos.x, y: toGoal.y - controlled.pos.y });
        kickBall(ball, controlled.pos, shootDir, shootSpeed, controlled.id, controlled.team);
        controlled.hasBall = false;
        ball.owner = null;
        ball.ownerTeam = null;
        this.pulseCooldown = 300;
      }

      // Pass
      if (input.pass && this.pulseCooldown <= 0 && controlled.hasBall) {
        const teammate = findPassTarget(controlled, home, away, ball, pitchWidth);
        if (!teammate) {
          // fallback pass forward
          const dir = controlled.team === 'home' ? { x: 1, y: 0 } : { x: -1, y: 0 };
          kickBall(ball, controlled.pos, dir, passSpeed, null, null);
        } else {
          const passDir = normalizeVec({ x: teammate.pos.x - controlled.pos.x, y: teammate.pos.y - controlled.pos.y });
          kickBall(ball, controlled.pos, passDir, passSpeed, null, null);
        }
        controlled.hasBall = false;
        this.pulseCooldown = 300;
      }

      // Tackle
      if (input.tackle && this.tackleCooldown <= 0) {
        attemptTackle(controlled, ball, home, away, tackleRadius);
        this.tackleCooldown = 400;
      }
    } else if (controlled) {
      // Not playing phase - nudge toward formation
      updatePlayer(controlled, { ax: 0, ay: 0, sprint: false }, dt, pitchWidth, pitchHeight);
    }

    // --- AI for all players ---
    updateAI(match, dt);

    // Apply AI movement (override player update for non-controlled)
    for (const p of [...home.players, ...away.players]) {
      if (p.id === controlled?.id) continue;
      applyAIMovement(p, ball, match, dt, pitchWidth, pitchHeight);
    }

    // --- Ball physics ---
    if (!ball.owner) {
      updateBall(ball, dt, pitchWidth, pitchHeight);
    } else {
      const owner = ball.owner ? getPlayerById(match, ball.owner) : null;
      if (owner && owner.hasBall) {
        dribbleBall(ball, owner, dt);
      } else {
        releaseBall(ball);
      }
    }

    // --- Ball collision with players (loose ball pickup) ---
    if (!ball.owner) {
      for (const p of [...home.players, ...away.players]) {
        if (dist(ball.pos, p.pos) <= playerRadius + ball.radius) {
          ball.owner = p.id;
          ball.ownerTeam = p.team;
          ball.kickable = false;
          p.hasBall = true;
          break;
        }
      }
    }

    // --- Referee: goals ---
    if (match.phase === 'playing') {
      const pitch = createPitch(pitchWidth, pitchHeight);
      if (isBallInGoal(pitch, ball.pos, 'home')) {
        scoreGoal(match, 'away');
      } else if (isBallInGoal(pitch, ball.pos, 'away')) {
        scoreGoal(match, 'home');
      }
    }

    // --- Goal restart timer ---
    if (match.phase === 'goal') {
      this.goalRestartTimer += dt * 1000;
      if (this.goalRestartTimer > 2000) {
        restartAfterGoal(match, pitchWidth, pitchHeight);
        this.goalRestartTimer = 0;
      }
    }

    // --- Out of bounds ---
    if (match.phase === 'playing') {
      const oob = checkOutOfBounds(match, pitchWidth, pitchHeight);
      if (oob !== 'none') {
        // Simple restart: kickoff for now
        match.phase = 'kickoff';
        resetPositions(match, pitchWidth, pitchHeight);
        const team = match.kickoffTeam === 'home' ? home : away;
        const carrier = team.players.find((p) => p.role === 'CM') || team.players[1];
        carrier.hasBall = true;
        match.controlledPlayerId = match.kickoffTeam === 'home' ? carrier.id : null;
        releaseBall(ball);
        ball.pos = { x: pitchWidth / 2, y: pitchHeight / 2 };
        ball.vel = { x: 0, y: 0 };
      }
    }

    // --- Match timer ---
    updateMatchTime(match, dt);

    // --- Camera follows ball ---
    match.camera.x = lerp(match.camera.x, ball.pos.x, 0.12);
    match.camera.y = lerp(match.camera.y, ball.pos.y, 0.12);
  }
}

function inputToVector(input: InputState): { x: number; y: number } {
  let x = 0, y = 0;
  if (input.left) x -= 1;
  if (input.right) x += 1;
  if (input.up) y -= 1;
  if (input.down) y += 1;
  const len = Math.hypot(x, y);
  return len > 0 ? { x: x / len, y: y / len } : { x: 0, y: 0 };
}

function normalizeVec(v: { x: number; y: number }): { x: number; y: number } {
  const d = Math.hypot(v.x, v.y) || 1;
  return { x: v.x / d, y: v.y / d };
}

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

function findPassTarget(
  player: Player,
  home: Team,
  away: Team,
  ball: Ball,
  pitchWidth: number
): Player | null {
  const team = player.team === 'home' ? home : away;
  let best: Player | null = null;
  let bestScore = -1;
  for (const t of team.players) {
    if (t.id === player.id || t.role === 'GK') continue;
    const d = dist(player.pos, t.pos);
    if (d < 40 || d > 160) continue;
    const forward = player.team === 'home' ? t.pos.x - player.pos.x : player.pos.x - t.pos.x;
    const score = forward * 0.6 - d * 0.004;
    if (score > bestScore) {
      bestScore = score;
      best = t;
    }
  }
  return best;
}

function attemptTackle(
  tackler: Player,
  ball: Ball,
  home: Team,
  away: Team,
  tackleRadius: number
): void {
  const opponent = tackler.team === 'home' ? away : home;
  for (const p of opponent.players) {
    if (!p.hasBall) continue;
    if (dist(tackler.pos, p.pos) <= tackleRadius && dist(ball.pos, tackler.pos) <= tackleRadius) {
      // Successful tackle - win possession
      p.hasBall = false;
      ball.owner = tackler.id;
      ball.ownerTeam = tackler.team;
      ball.kickable = false;
      tackler.hasBall = true;
      // Knock ball slightly away
      ball.vel.x = (Math.random() - 0.5) * 60;
      ball.vel.y = (Math.random() - 0.5) * 60;
      return;
    }
  }
}

function applyAIMovement(
  player: Player,
  ball: Ball,
  match: MatchState,
  dt: number,
  pitchWidth: number,
  pitchHeight: number
): void {
  // AI already positioned players in updateAI; apply velocity clamping + pitch clamp
  const spd = Math.hypot(player.vel.x, player.vel.y);
  const maxSpd = player.speed;
  if (spd > maxSpd) {
    player.vel.x = (player.vel.x / spd) * maxSpd;
    player.vel.y = (player.vel.y / spd) * maxSpd;
  }
  player.pos.x += player.vel.x * dt;
  player.pos.y += player.vel.y * dt;
  player.pos.x = Math.max(player.radius, Math.min(pitchWidth - player.radius, player.pos.x));
  player.pos.y = Math.max(player.radius, Math.min(pitchHeight - player.radius, player.pos.y));

  // Dribble if AI has ball
  if (player.hasBall && ball.owner === player.id) {
    dribbleBall(ball, player, dt);
  }
}
