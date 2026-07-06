import { BOMBER, WORLD } from "./tuning";

/** Clamp helper shared across the game. */
export function clamp(v: number, lo: number, hi: number): number {
  return v < lo ? lo : v > hi ? hi : v;
}

/** Linear interpolation for render smoothing. */
export function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

/**
 * The player bomber. Auto-flies (the world scrolls past it), so it holds a
 * fixed vertical anchor and only moves laterally. We keep `prevX` so the
 * renderer can interpolate between fixed-timestep states.
 */
export class Bomber {
  x: number;
  prevX: number;
  readonly y: number;
  /** Where the plane is steering toward, in world x. */
  targetX: number;
  /** Visual bank angle (radians), eased toward lateral velocity. */
  roll = 0;
  readonly radius = BOMBER.radius;

  constructor() {
    this.x = WORLD.width / 2;
    this.prevX = this.x;
    this.targetX = this.x;
    this.y = WORLD.height * BOMBER.anchorY;
  }

  reset(): void {
    this.x = WORLD.width / 2;
    this.prevX = this.x;
    this.targetX = this.x;
    this.roll = 0;
  }

  /** dt in seconds. Chases targetX with an eased, speed-capped move. */
  update(dt: number): void {
    this.prevX = this.x;

    const lo = BOMBER.edgePadding;
    const hi = WORLD.width - BOMBER.edgePadding;
    this.targetX = clamp(this.targetX, lo, hi);

    // Exponential chase, then cap the per-step displacement to maxLateralSpeed.
    const chase = 1 - Math.exp(-BOMBER.lateralResponse * dt);
    let desired = (this.targetX - this.x) * chase;
    const maxStep = BOMBER.maxLateralSpeed * dt;
    desired = clamp(desired, -maxStep, maxStep);

    this.x = clamp(this.x + desired, lo, hi);

    // Bank toward motion for readable feedback.
    const vel = desired / dt; // world units / sec
    const targetRoll = clamp(vel / BOMBER.maxLateralSpeed, -1, 1) * 0.5;
    this.roll += (targetRoll - this.roll) * (1 - Math.exp(-10 * dt));
  }

  /** Interpolated render x. */
  renderX(alpha: number): number {
    return lerp(this.prevX, this.x, alpha);
  }
}
