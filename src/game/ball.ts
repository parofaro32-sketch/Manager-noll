import { Ball, Player, Team, Vector } from './types.ts';
import { dist, clampToPitch } from './pitch.ts';

export function createBall(x: number, y: number): Ball {
  return {
    pos: { x, y },
    vel: { x: 0, y: 0 },
    radius: 7,
    owner: null,
    ownerTeam: null,
    kickable: true,
    onGround: true,
  };
}

export function updateBall(ball: Ball, dt: number, pitchWidth: number, pitchHeight: number): void {
  // Apply friction
  const friction = 0.96;
  ball.vel.x *= friction;
  ball.vel.y *= friction;

  // Stop near-zero velocity
  if (Math.abs(ball.vel.x) < 0.5) ball.vel.x = 0;
  if (Math.abs(ball.vel.y) < 0.5) ball.vel.y = 0;

  ball.pos.x += ball.vel.x * dt;
  ball.pos.y += ball.vel.y * dt;

  // Clamp to pitch bounds (keep ball on pitch; out-of-bounds handled by referee)
  ball.pos.x = Math.max(0, Math.min(pitchWidth, ball.pos.x));
  ball.pos.y = Math.max(0, Math.min(pitchHeight, ball.pos.y));
}

export function kickBall(
  ball: Ball,
  from: Vector,
  dir: Vector,
  speed: number,
  ownerId: string | null,
  ownerTeam: 'home' | 'away' | null
): void {
  const len = Math.hypot(dir.x, dir.y) || 1;
  ball.vel.x = (dir.x / len) * speed;
  ball.vel.y = (dir.y / len) * speed;
  ball.pos.x = from.x;
  ball.pos.y = from.y;
  ball.owner = ownerId;
  ball.ownerTeam = ownerTeam;
  ball.kickable = false;
}

export function releaseBall(ball: Ball): void {
  ball.owner = null;
  ball.ownerTeam = null;
  ball.kickable = true;
}

export function setBallPossession(
  ball: Ball,
  player: Player | null,
  team: 'home' | 'away' | null
): void {
  ball.owner = player ? player.id : null;
  ball.ownerTeam = team;
  ball.kickable = player === null;
}

export function isBallKickable(ball: Ball, playerPos: Vector, kickableRadius: number): boolean {
  return dist(ball.pos, playerPos) <= kickableRadius + ball.radius;
}

export function dribbleBall(ball: Ball, player: Player, dt: number): void {
  // Ball sticks slightly ahead of the dribbler
  const dirX = Math.cos(player.direction);
  const dirY = Math.sin(player.direction);
  const offsetDist = player.radius + ball.radius + 6;
  ball.pos.x = player.pos.x + dirX * offsetDist;
  ball.pos.y = player.pos.y + dirY * offsetDist;
  ball.vel.x = player.vel.x * 0.6;
  ball.vel.y = player.vel.y * 0.6;
  ball.owner = player.id;
  ball.ownerTeam = player.team;
  ball.kickable = false;
}
