import {
  MatchState,
  Team,
  TeamId,
  Player,
  Ball,
  Vector,
} from './types.ts';
import { dist, isBallInGoal, isBallOutOfBounds, goalLineForTeam, createPitch } from './pitch.ts';
import { releaseBall } from './ball.ts';

const MATCH_TIME = 180; // seconds per half for base test

export function createReferee(
  home: Team,
  away: Team,
  ball: Ball,
  pitchWidth: number,
  pitchHeight: number
): MatchState {
  const homeGoal: Vector = { x: pitchWidth, y: pitchHeight / 2 };
  const awayGoal: Vector = { x: 0, y: pitchHeight / 2 };

  return {
    phase: 'kickoff',
    time: 0,
    maxTime: MATCH_TIME,
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
}

export function resetPositions(match: MatchState, pitchWidth: number, pitchHeight: number): void {
  // Home attacks toward right (positive x). Away attacks toward left.
  const homeAttackDir = 1;
  const awayAttackDir = -1;

  match.home.players.forEach((p) => {
    p.aiState = p.team === 'home' ? 'defending' : 'attacking';
    if (p.role === 'GK') {
      p.pos = { x: p.team === 'home' ? pitchWidth - 40 : 40, y: pitchHeight / 2 };
    } else {
      p.pos = { x: pitchWidth / 2 + (p.team === 'home' ? 40 : -40), y: pitchHeight / 2 };
    }
    p.vel = { x: 0, y: 0 };
    p.hasBall = false;
    p.controlTimer = 0;
    p.direction = p.team === 'home' ? 0 : Math.PI;
  });

  match.away.players.forEach((p) => {
    p.aiState = p.team === 'home' ? 'defending' : 'attacking';
    if (p.role === 'GK') {
      p.pos = { x: p.team === 'home' ? pitchWidth - 40 : 40, y: pitchHeight / 2 };
    } else {
      p.pos = { x: pitchWidth / 2 + (p.team === 'home' ? -40 : 40), y: pitchHeight / 2 };
    }
    p.vel = { x: 0, y: 0 };
    p.hasBall = false;
    p.controlTimer = 0;
    p.direction = p.team === 'home' ? Math.PI : 0;
  });

  match.ball.pos = { x: pitchWidth / 2, y: pitchHeight / 2 };
  match.ball.vel = { x: 0, y: 0 };
  releaseBall(match.ball);
}

export function startKickoff(match: MatchState, pitchWidth: number, pitchHeight: number): void {
  match.phase = 'playing';
  match.ball.pos = { x: pitchWidth / 2, y: pitchHeight / 2 };
  match.ball.vel = { x: 0, y: 0 };
  releaseBall(match.ball);

  const team = match.kickoffTeam === 'home' ? match.home : match.away;
  const ballCarrier = team.players.find((p) => p.role === 'CM') || team.players[1];
  ballCarrier.hasBall = true;
  match.controlledPlayerId = match.kickoffTeam === 'home' ? ballCarrier.id : null;
}

export function scoreGoal(match: MatchState, scoringTeam: TeamId): void {
  if (scoringTeam === 'home') match.homeScore += 1;
  else match.awayScore += 1;

  match.phase = 'goal';
  match.kickoffTeam = scoringTeam === 'home' ? 'away' : 'home';
}

export function restartAfterGoal(match: MatchState, pitchWidth: number, pitchHeight: number): void {
  match.phase = 'kickoff';
  resetPositions(match, pitchWidth, pitchHeight);
}

export function updateMatchTime(match: MatchState, dt: number): boolean {
  if (match.phase === 'ended') return false;
  match.time += dt;
  if (match.time >= match.maxTime) {
    match.phase = 'ended';
    match.winner =
      match.homeScore > match.awayScore
        ? 'home'
        : match.awayScore < match.homeScore
          ? 'away'
          : null;
    return true;
  }
  return false;
}

export function checkOutOfBounds(
  match: MatchState,
  pitchWidth: number,
  pitchHeight: number
): 'none' | 'throwin' | 'corner' | 'goalKick' {
  const { ball } = match;
  if (ball.pos.y < 0 || ball.pos.y > pitchHeight) return 'throwin';
  if (ball.pos.x < 0) {
    // Ball crossed away team's end line (home goal line) -> last touched by away = corner for home? 
    // Simplified: if ball leaves at home's end line (x<0) and wasn't a goal, goal kick for home.
    return 'goalKick';
  }
  if (ball.pos.x > pitchWidth) return 'goalKick';
  return 'none';
}

export function updateControlledPlayer(match: MatchState, playerId: string | null): void {
  // Clear previous
  match.home.players.forEach((p) => { p.hasBall = p.id === playerId && p.hasBall; });
  match.away.players.forEach((p) => { p.hasBall = p.id === playerId && p.hasBall; });
  match.controlledPlayerId = playerId;
}

export function getTeamById(match: MatchState, teamId: TeamId): Team {
  return teamId === 'home' ? match.home : match.away;
}

export function getPlayerById(match: MatchState, id: string): Player | null {
  for (const p of match.home.players) if (p.id === id) return p;
  for (const p of match.away.players) if (p.id === id) return p;
  return null;
}

export function getOpponentTeam(match: MatchState, teamId: TeamId): Team {
  return teamId === 'home' ? match.away : match.home;
}
