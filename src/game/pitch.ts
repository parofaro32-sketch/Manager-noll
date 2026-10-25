import { Pitch, Vector, TeamId } from './types.ts';

const DEFAULT_CONFIG = {
  width: 1050,
  height: 680,
  goalWidth: 140,
  goalDepth: 24,
  penaltyAreaW: 320,
  penaltyAreaH: 180,
  centerCircleRadius: 90,
} as const;

export function createPitch(width: number, height: number): Pitch {
  const halfWidth = width / 2;
  const halfHeight = height / 2;
  const goalWidth = DEFAULT_CONFIG.goalWidth;
  const goalDepth = DEFAULT_CONFIG.goalDepth;
  const penaltyAreaW = DEFAULT_CONFIG.penaltyAreaW;
  const penaltyAreaH = DEFAULT_CONFIG.penaltyAreaH;

  return {
    width,
    height,
    halfWidth,
    halfHeight,
    center: { x: halfWidth, y: halfHeight },
    goalWidth,
    goalDepth,
    penaltyArea: [
      { x: 0, y: halfHeight - penaltyAreaH / 2, w: penaltyAreaW, h: penaltyAreaH },
      { x: width - penaltyAreaW, y: halfHeight - penaltyAreaH / 2, w: penaltyAreaW, h: penaltyAreaH },
    ],
    centerCircleRadius: DEFAULT_CONFIG.centerCircleRadius,
    goalLineHome: -goalDepth,
    goalLineAway: width + goalDepth,
    leftBound: 0,
    rightBound: width,
    topBound: 0,
    bottomBound: height,
  };
}

export function isInsidePitch(pitch: Pitch, pos: Vector): boolean {
  return (
    pos.x >= pitch.leftBound &&
    pos.x <= pitch.rightBound &&
    pos.y >= pitch.topBound &&
    pos.y <= pitch.bottomBound
  );
}

export function clampToPitch(pitch: Pitch, pos: Vector): Vector {
  return {
    x: Math.max(pitch.leftBound, Math.min(pitch.rightBound, pos.x)),
    y: Math.max(pitch.topBound, Math.min(pitch.bottomBound, pos.y)),
  };
}

export function goalLineForTeam(pitch: Pitch, teamId: TeamId): number {
  return teamId === 'home' ? pitch.goalLineAway : pitch.goalLineHome;
}

export function isBallInGoal(pitch: Pitch, ballPos: Vector, teamId: TeamId): boolean {
  const goalLine = goalLineForTeam(pitch, teamId);
  const goalY = pitch.height / 2;
  const halfGoal = pitch.goalWidth / 2;

  if (teamId === 'home') {
    return ballPos.x >= pitch.rightBound && Math.abs(ballPos.y - goalY) <= halfGoal;
  }
  return ballPos.x <= pitch.leftBound && Math.abs(ballPos.y - goalY) <= halfGoal;
}

export function isBallOutOfBounds(pitch: Pitch, ballPos: Vector): 'none' | 'sideline' | 'endline' {
  if (ballPos.y < 0 || ballPos.y > pitch.height) return 'sideline';
  if (ballPos.x < 0 || ballPos.x > pitch.width) return 'endline';
  return 'none';
}

export function nearestPointOnSegment(p: Vector, a: Vector, b: Vector): Vector {
  const ab = { x: b.x - a.x, y: b.y - a.y };
  const ap = { x: p.x - a.x, y: p.y - a.y };
  const t = Math.max(0, Math.min(1, (ap.x * ab.x + ap.y * ab.y) / (ab.x * ab.x + ab.y * ab.y)));
  return { x: a.x + ab.x * t, y: a.y + ab.y * t };
}

export function dist(a: Vector, b: Vector): number {
  return Math.hypot(a.x - b.x, a.y - b.y);
}
