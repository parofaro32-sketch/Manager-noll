import {
  Player,
  AIState,
  Team,
  TeamId,
  Ball,
  Vector,
  MatchState,
} from './types.ts';
import { dist, goalLineForTeam } from './pitch.ts';

const POSSESSION_RADIUS = 60;
const PASS_RADIUS = 160;
const SHOOT_DIST_TO_GOAL = 220;
const PRESS_DIST = 120;
const MARK_DIST = 100;
const RECOVER_DIST = 200;

export function updateAI(match: MatchState, dt: number): void {
  const { ball, home, away } = match;
  const teams = [home, away];

  // Determine possession team
  const possessionTeam = ball.ownerTeam || (ball.owner ? getBallOwnerTeam(match, ball.owner) : null);

  for (const team of teams) {
    const hasPossession = possessionTeam === team.id;
    const opponent = team.id === 'home' ? away : home;
    const attackGoal = team.id === 'home' ? { x: 1050, y: 525 } : { x: 0, y: 525 }; // will be set by caller pitch
    const defendGoal = team.id === 'home' ? { x: 0, y: 525 } : { x: 1050, y: 525 };

    for (const player of team.players) {
      if (player.role === 'GK') {
        updateGoalkeeperAI(player, ball, team, defendGoal, dt);
        continue;
      }

      if (hasPossession) {
        updateAttackingAI(player, ball, team, opponent, attackGoal, dt, match);
      } else {
        updateDefendingAI(player, ball, team, opponent, defendGoal, dt);
      }
    }
  }
}

function getBallOwnerTeam(match: MatchState, ownerId: string): TeamId | null {
  for (const p of match.home.players) if (p.id === ownerId) return p.team;
  for (const p of match.away.players) if (p.id === ownerId) return p.team;
  return null;
}

// ---------- ATTACKING AI ----------

function updateAttackingAI(
  player: Player,
  ball: Ball,
  team: Team,
  opponent: Team,
  attackGoal: Vector,
  dt: number,
  match: MatchState
): void {
  const hasBall = ball.owner === player.id;

  if (hasBall) {
    player.aiState = 'attacking';
    player.hasBall = true;
    player.controlTimer += dt;

    const toGoal = { x: attackGoal.x - player.pos.x, y: attackGoal.y - player.pos.y };
    const distToGoal = Math.hypot(toGoal.x, toGoal.y);

    // Shoot if close enough and clear
    if (distToGoal < SHOOT_DIST_TO_GOAL && player.controlTimer > 0.4) {
      const shootDir = normalize(toGoal);
      // Ball will be kicked by engine on shoot input
      player.target = { x: player.pos.x + shootDir.x * 200, y: player.pos.y + shootDir.y * 200 };
      return;
    }

    // Pass to teammate in good position
    const teammate = findPassTarget(player, team, opponent, ball);
    if (teammate && dist(player.pos, teammate.pos) < PASS_RADIUS && player.controlTimer > 300) {
      const passDir = normalize({ x: teammate.pos.x - player.pos.x, y: teammate.pos.y - player.pos.y });
      player.target = { x: player.pos.x + passDir.x * 200, y: player.pos.y + passDir.y * 200 };
      return;
    }

    // Dribble toward goal
    player.target = attackGoal;
    aiMoveWithBall(player, attackGoal, 1.0, dt);
  } else {
    player.hasBall = false;
    player.aiState = 'supporting';

    const ballCarrier = team.players.find((p) => p.hasBall) || team.players[0];
    if (ballCarrier && ballCarrier.id !== player.id) {
      // Support: move to open space ahead of ball carrier
      const supportPos = computeSupportPosition(player, ballCarrier, attackGoal);
      aiMoveToward(player, supportPos, 0.9, dt);
    } else {
      aiMoveToward(player, attackGoal, 0.8, dt);
    }
  }
}

function findPassTarget(
  player: Player,
  team: Team,
  opponent: Team,
  ball: Ball
): Player | null {
  let best: Player | null = null;
  let bestScore = -1;

  for (const t of team.players) {
    if (t.id === player.id || t.role === 'GK') continue;
    const d = dist(player.pos, t.pos);
    if (d < 40 || d > PASS_RADIUS) continue;

    // Is there an opponent between?
    const blocked = opponent.players.some(
      (o) => dist(o.pos, player.pos) < d && dist(o.pos, t.pos) < d * 0.8
    );
    if (blocked) continue;

    // Prefer forward (toward opponent goal)
    const forward = t.pos.x - player.pos.x;
    const score = forward * 0.6 - d * 0.004;
    if (score > bestScore) {
      bestScore = score;
      best = t;
    }
  }
  return best;
}

function computeSupportPosition(
  player: Player,
  carrier: Player,
  attackGoal: Vector
): Vector {
  // Offset to the side of carrier, ahead toward goal
  const toGoal = normalize({ x: attackGoal.x - carrier.pos.x, y: attackGoal.y - carrier.pos.y });
  const perp = { x: -toGoal.y, y: toGoal.x };
  const side = player.pos.x < carrier.pos.x ? -1 : 1;
  return {
    x: carrier.pos.x + toGoal.x * 70 + perp.x * 45 * side,
    y: carrier.pos.y + toGoal.y * 70 + perp.y * 45 * side,
  };
}

function aiMoveWithBall(player: Player, target: Vector, speedMult: number, dt: number): void {
  const dx = target.x - player.pos.x;
  const dy = target.y - player.pos.y;
  const d = Math.hypot(dx, dy);
  if (d < 1) return;
  const speed = player.speed * speedMult;
  player.vel.x = (dx / d) * speed;
  player.vel.y = (dy / d) * speed;
  player.direction = Math.atan2(dy, dx);
}

// ---------- DEFENDING AI ----------

function updateDefendingAI(
  player: Player,
  ball: Ball,
  team: Team,
  opponent: Team,
  defendGoal: Vector,
  dt: number
): void {
  const ballCarrier = opponent.players.find((p) => p.hasBall);
  const distToBall = dist(player.pos, ball.pos);

  // Nearest defender to ball presses
  const nearestDist = Math.min(...opponent.players.map((p) => dist(p.pos, ball.pos)));
  const amNearest = distToBall <= nearestDist + 5;

  if (ballCarrier && amNearest && distToBall < PRESS_DIST) {
    player.aiState = 'pressing';
    aiMoveToward(player, ballCarrier.pos, 1.05, dt);
    player.direction = Math.atan2(
      ballCarrier.pos.y - player.pos.y,
      ballCarrier.pos.x - player.pos.x
    );
  } else if (ballCarrier) {
    // Mark dangerous opponent / cover passing lanes
    const marked = findMarkTarget(player, opponent, ballCarrier);
    if (marked) {
      player.aiState = 'marking';
      const markPos = {
        x: (marked.pos.x + ball.pos.x) / 2,
        y: (marked.pos.y + ball.pos.y) / 2,
      };
      aiMoveToward(player, markPos, 0.85, dt);
    } else {
      player.aiState = 'defending';
      aiMoveToward(player, defendGoal, 0.8, dt);
    }
  } else {
    player.aiState = 'recovering';
    aiMoveToward(player, defendGoal, 0.75, dt);
  }
}

function findMarkTarget(player: Player, opponent: Team, ballCarrier: Player): Player | null {
  let best: Player | null = null;
  let bestScore = -1;
  for (const o of opponent.players) {
    if (o.id === ballCarrier.id) continue;
    const danger = dist(o.pos, { x: 1050, y: 525 }); // closeness to home goal
    const score = -danger * 0.01;
    if (score > bestScore) {
      bestScore = score;
      best = o;
    }
  }
  return best;
}

// ---------- GOALKEEPER AI ----------

function updateGoalkeeperAI(
  player: Player,
  ball: Ball,
  team: Team,
  defendGoal: Vector,
  dt: number
): void {
  player.aiState = 'goalkeeper';
  const toBall = { x: ball.pos.x - player.pos.x, y: ball.pos.y - player.pos.y };
  const distToBall = Math.hypot(toBall.x, toBall.y);

  // Stay near goal line but come out for loose ball nearby
  const goalLineX = team.id === 'home' ? 40 : 1010;
  const targetY = clamp(ball.pos.y, 430, 620);
  let targetX = goalLineX;

  if (distToBall < 130 && ball.pos.x > (team.id === 'home' ? 150 : 900)) {
    targetX = ball.pos.x;
  }

  let finalTargetY = targetY;
  if (distToBall < 130 && ball.pos.x > (team.id === 'home' ? 150 : 900)) {
    finalTargetY = ball.pos.y;
  }

  aiMoveToward(player, { x: targetX, y: finalTargetY }, 0.9, dt);

  // Collect ball if very close
  if (distToBall < player.radius + ball.radius + 8 && ball.ownerTeam !== team.id) {
    ball.owner = player.id;
    ball.ownerTeam = team.id;
    player.hasBall = true;
  }

  // If GK has ball, throw/kick back into field
  if (player.hasBall) {
    const outDir = team.id === 'home' ? { x: 1, y: 0 } : { x: -1, y: 0 };
    player.target = { x: player.pos.x + outDir.x * 200, y: player.pos.y + outDir.y * 200 };
  }
}

export function aiMoveToward(player: Player, target: Vector, speedMult: number, dt: number): void {
  const dx = target.x - player.pos.x;
  const dy = target.y - player.pos.y;
  const d = Math.hypot(dx, dy);
  if (d < 1) return;
  const speed = player.speed * speedMult;
  player.vel.x = (dx / d) * speed;
  player.vel.y = (dy / d) * speed;
  player.direction = Math.atan2(dy, dx);
}

export function clamp(v: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, v));
}

export function normalize(v: Vector): Vector {
  const d = Math.hypot(v.x, v.y) || 1;
  return { x: v.x / d, y: v.y / d };
}
