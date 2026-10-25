export type TeamId = 'home' | 'away';

export type PlayerRole =
  | 'GK' | 'CB' | 'LB' | 'RB' | 'CDM' | 'CM' | 'CAM' | 'LM' | 'RM' | 'LW' | 'RW' | 'ST';

export type AIState =
  | 'attacking' | 'defending' | 'supporting' | 'pressing' | 'marking' | 'recovering' | 'goalkeeper';

export interface Vector {
  x: number;
  y: number;
}

export interface Player {
  id: string;
  team: TeamId;
  role: PlayerRole;
  number: number;
  name: string;
  pos: Vector;
  vel: Vector;
  target: Vector;
  radius: number;
  speed: number;
  sprintSpeed: number;
  stamina: number;
  attributes: {
    pace: number;
    shooting: number;
    passing: number;
    dribbling: number;
    defending: number;
    physical: number;
  };
  aiState: AIState;
  hasBall: boolean;
  controlTimer: number;
  direction: number;
}

export interface Ball {
  pos: Vector;
  vel: Vector;
  radius: number;
  owner: string | null;
  ownerTeam: TeamId | null;
  kickable: boolean;
  onGround: boolean;
}

export interface Team {
  id: TeamId;
  name: string;
  color: string;
  score: number;
  players: Player[];
  goal: Vector;
  attackDir: number;
}

export interface Pitch {
  width: number;
  height: number;
  halfWidth: number;
  halfHeight: number;
  center: Vector;
  goalWidth: number;
  goalDepth: number;
  penaltyArea: { x: number; y: number; w: number; h: number }[];
  centerCircleRadius: number;
  goalLineHome: number;
  goalLineAway: number;
  leftBound: number;
  rightBound: number;
  topBound: number;
  bottomBound: number;
}

export interface MatchState {
  phase: 'kickoff' | 'playing' | 'goal' | 'throwin' | 'corner' | 'goalKick' | 'ended';
  time: number;
  maxTime: number;
  homeScore: number;
  awayScore: number;
  kickoffTeam: TeamId;
  ball: Ball;
  home: Team;
  away: Team;
  controlledPlayerId: string | null;
  camera: Vector;
  winner: TeamId | null;
}

export interface InputState {
  up: boolean;
  down: boolean;
  left: boolean;
  right: boolean;
  sprint: boolean;
  pass: boolean;
  shoot: boolean;
  tackle: boolean;
  switchPlayer: boolean;
}

export interface GameConfig {
  pitchWidth: number;
  pitchHeight: number;
  matchTime: number;
  playerSpeed: number;
  playerSprintSpeed: number;
  playerRadius: number;
  ballRadius: number;
  ballSpeed: number;
  passSpeed: number;
  shootSpeed: number;
  tackleRadius: number;
  kickableRadius: number;
  aiReactionDelay: number;
  gkSpeed: number;
  dt: number;
}
