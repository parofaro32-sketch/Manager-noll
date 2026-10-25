import { Player, PlayerRole, TeamId, AIState, Vector } from './types.ts';

const ROLE_BASE_POSITIONS: Record<PlayerRole, { x: number; y: number }> = {
  GK: { x: 50, y: 88 },
  LB: { x: 15, y: 70 },
  CB: { x: 38, y: 72 },
  RB: { x: 85, y: 70 },
  CDM: { x: 50, y: 58 },
  CM: { x: 38, y: 48 },
  CAM: { x: 50, y: 35 },
  LM: { x: 15, y: 45 },
  RM: { x: 85, y: 45 },
  LW: { x: 22, y: 22 },
  ST: { x: 50, y: 18 },
  RW: { x: 78, y: 22 },
};

function roleSpeed(role: PlayerRole): { speed: number; sprintSpeed: number } {
  const base = role === 'GK' ? 55 : role === 'CB' ? 60 : 68;
  const sprint = base + 18;
  return { speed: base, sprintSpeed: sprint };
}

export function createPlayer(
  id: string,
  team: TeamId,
  role: PlayerRole,
  number: number,
  name: string,
  pitchX: number,
  pitchY: number,
  attackDir: number
): Player {
  const { speed, sprintSpeed } = roleSpeed(role);
  const base = ROLE_BASE_POSITIONS[role] || { x: 50, y: 50 };

  // Convert percentage positions (0-100) to pitch coords
  let x = (base.x / 100) * pitchX;
  let y = (base.y / 100) * pitchY;

  if (attackDir === -1) {
    x = pitchX - x;
    y = pitchY - y;
  }

  return {
    id,
    team,
    role,
    number,
    name,
    pos: { x, y },
    vel: { x: 0, y: 0 },
    target: { x, y },
    radius: 10,
    speed,
    sprintSpeed,
    stamina: 100,
    attributes: {
      pace: 70,
      shooting: 70,
      passing: 70,
      dribbling: 70,
      defending: 70,
      physical: 70,
    },
    aiState: 'defending',
    hasBall: false,
    controlTimer: 0,
    direction: attackDir === 1 ? 0 : Math.PI,
  };
}

export function updatePlayer(
  player: Player,
  input: { ax: number; ay: number; sprint: boolean },
  dt: number,
  pitchWidth: number,
  pitchHeight: number
): void {
  const isSprint = input.sprint && player.stamina > 0;
  const maxSpeed = isSprint ? player.sprintSpeed : player.speed;
  const accel = isSprint ? 2400 : 1600;
  const decel = 1400;

  const ax = input.ax * accel;
  const ay = input.ay * accel;

  player.vel.x += ax * dt;
  player.vel.y += ay * dt;

  // Friction / deceleration when no input
  if (input.ax === 0) player.vel.x *= Math.pow(0.85, dt * 60);
  if (input.ay === 0) player.vel.y *= Math.pow(0.85, dt * 60);

  // Clamp speed
  const spd = Math.hypot(player.vel.x, player.vel.y);
  if (spd > maxSpeed) {
    player.vel.x = (player.vel.x / spd) * maxSpeed;
    player.vel.y = (player.vel.y / spd) * maxSpeed;
  }

  player.pos.x += player.vel.x * dt;
  player.pos.y += player.vel.y * dt;

  // Clamp to pitch
  player.pos.x = Math.max(player.radius, Math.min(pitchWidth - player.radius, player.pos.x));
  player.pos.y = Math.max(player.radius, Math.min(pitchHeight - player.radius, player.pos.y));

  // Stamina
  if (isSprint) {
    player.stamina = Math.max(0, player.stamina - dt * 25);
  } else {
    player.stamina = Math.min(100, player.stamina + dt * 12);
  }

  // Update facing direction based on movement
  if (Math.hypot(player.vel.x, player.vel.y) > 0.5) {
    player.direction = Math.atan2(player.vel.y, player.vel.x);
  }
}

export function aiMoveToward(player: Player, target: Vector, speedMult: number, dt: number): void {
  const dx = target.x - player.pos.x;
  const dy = target.y - player.pos.y;
  const dist = Math.hypot(dx, dy);
  if (dist < 1) return;
  const desiredSpeed = (player.speed * speedMult);
  player.vel.x = (dx / dist) * desiredSpeed;
  player.vel.y = (dy / dist) * desiredSpeed;
  player.pos.x += player.vel.x * dt;
  player.pos.y += player.vel.y * dt;
  player.direction = Math.atan2(dy, dx);
}

export function stopPlayer(player: Player): void {
  player.vel.x = 0;
  player.vel.y = 0;
}

export function setAIState(player: Player, state: AIState): void {
  player.aiState = state;
}
