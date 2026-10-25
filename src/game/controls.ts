import { InputState } from './types.ts';

export function createInput(): InputState {
  return {
    up: false,
    down: false,
    left: false,
    right: false,
    sprint: false,
    pass: false,
    shoot: false,
    tackle: false,
    switchPlayer: false,
  };
}

export class KeyboardControls {
  input: InputState;
  private keyMap: Map<string, keyof InputState>;

  constructor(input: InputState) {
    this.input = input;
    this.keyMap = new Map([
      ['ArrowUp', 'up'],
      ['ArrowDown', 'down'],
      ['ArrowLeft', 'left'],
      ['ArrowRight', 'right'],
      ['KeyW', 'up'],
      ['KeyS', 'down'],
      ['KeyA', 'left'],
      ['KeyD', 'right'],
      ['ShiftLeft', 'sprint'],
      ['ShiftRight', 'sprint'],
      ['Space', 'pass'],
      ['KeyK', 'shoot'],
      ['KeyJ', 'tackle'],
      ['Tab', 'switchPlayer'],
    ]);

    this.onKeyDown = this.onKeyDown.bind(this);
    this.onKeyUp = this.onKeyUp.bind(this);
  }

  connect(): void {
    window.addEventListener('keydown', this.onKeyDown);
    window.addEventListener('keyup', this.onKeyUp);
  }

  disconnect(): void {
    window.removeEventListener('keydown', this.onKeyDown);
    window.removeEventListener('keyup', this.onKeyUp);
  }

  private onKeyDown(e: KeyboardEvent): void {
    const action = this.keyMap.get(e.code);
    if (action) {
      this.input[action] = true;
      if (action === 'pass' || action === 'shoot' || action === 'tackle' || action === 'switchPlayer') {
        // One-shot: reset next frame via clearPulses
      }
    }
  }

  private onKeyUp(e: KeyboardEvent): void {
    const action = this.keyMap.get(e.code);
    if (action) {
      this.input[action] = false;
    }
  }

  clearPulses(): void {
    this.input.pass = false;
    this.input.shoot = false;
    this.input.tackle = false;
    this.input.switchPlayer = false;
  }
}

export class TouchControls {
  input: InputState;
  private stickActive = false;
  private stickStartX = 0;
  private stickStartY = 0;
  private stickPosX = 0;
  private stickPosY = 0;

  constructor(input: InputState) {
    this.input = input;
  }

  connect(): void {
    // Exposed via TouchUI for DOM binding; no global listeners here
  }

  disconnect(): void {}

  setStick(active: boolean, startX: number, startY: number, posX: number, posY: number): void {
    this.stickActive = active;
    this.stickStartX = startX;
    this.stickStartY = startY;
    this.stickPosX = posX;
    this.stickPosY = posY;
    this.updateInput();
  }

  setButton(name: keyof InputState, pressed: boolean): void {
    this.input[name] = pressed;
  }

  private updateInput(): void {
    if (!this.stickActive) {
      this.input.up = false;
      this.input.down = false;
      this.input.left = false;
      this.input.right = false;
      return;
    }
    const dx = this.stickPosX - this.stickStartX;
    const dy = this.stickPosY - this.stickStartY;
    const dist = Math.hypot(dx, dy);
    const maxDist = 60;
    const normX = Math.max(-1, Math.min(1, dx / maxDist));
    const normY = Math.max(-1, Math.min(1, dy / maxDist));

    this.input.up = normY < -0.3;
    this.input.down = normY > 0.3;
    this.input.left = normX < -0.3;
    this.input.right = normX > 0.3;
  }

  getStickVector(): { x: number; y: number } {
    const dx = this.stickPosX - this.stickStartX;
    const dy = this.stickPosY - this.stickStartY;
    return { x: dx, y: dy };
  }
}

export function inputToVector(input: InputState): { x: number; y: number } {
  let x = 0;
  let y = 0;
  if (input.left) x -= 1;
  if (input.right) x += 1;
  if (input.up) y -= 1;
  if (input.down) y += 1;
  const len = Math.hypot(x, y);
  if (len > 0) {
    x /= len;
    y /= len;
  }
  return { x, y };
}
