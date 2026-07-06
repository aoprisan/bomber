import { clamp } from "../entities";
import { GROUND, SEARCHLIGHT, WORLD } from "../tuning";

const GROUND_TOP = WORLD.height * (1 - GROUND.bandHeight);
const CONE_LEN = WORLD.height * 1.3;
const DEG = Math.PI / 180;

/**
 * Searchlight cone. Sweeps slowly from a ground origin; while the bomber stays
 * inside the cone, exposure builds. Past catchMs it "locks" and requests a
 * night fighter (consumed by the game), then goes on cooldown. Harmless itself.
 */
export class Searchlight {
  ox = 0;
  private oy = GROUND_TOP;
  private baseAngle = 0;
  age = 0;
  exposure = 0;
  private cooldown = 0;
  private wantsFighter = false;

  spawn(ox: number, baseAngle: number): void {
    this.ox = ox;
    this.oy = GROUND_TOP;
    this.baseAngle = baseAngle;
    this.age = 0;
    this.exposure = 0;
    this.cooldown = 0;
    this.wantsFighter = false;
  }

  get dead(): boolean {
    return this.age >= SEARCHLIGHT.lifeMs;
  }

  /** Cone centerline angle (off vertical) at the current time. */
  private get centerAngle(): number {
    const s = Math.sin((this.age / SEARCHLIGHT.sweepPeriodMs) * Math.PI * 2);
    return this.baseAngle + s * SEARCHLIGHT.sweepDeg * DEG;
  }

  /** Angle of the bomber as seen from the gun (off vertical). */
  private bomberAngle(bx: number, by: number): number {
    return Math.atan2(bx - this.ox, this.oy - by);
  }

  private contains(bx: number, by: number): boolean {
    if (by >= this.oy) return false;
    const diff = Math.abs(this.bomberAngle(bx, by) - this.centerAngle);
    return diff <= SEARCHLIGHT.halfAngleDeg * DEG;
  }

  /** 0..1 lock progress, for HUD/visual intensity. */
  get lockProgress(): number {
    return clamp(this.exposure / SEARCHLIGHT.catchMs, 0, 1);
  }

  update(dtMs: number, bx: number, by: number): void {
    this.age += dtMs;
    if (this.cooldown > 0) this.cooldown = Math.max(0, this.cooldown - dtMs);

    if (this.cooldown <= 0 && this.contains(bx, by)) {
      this.exposure += dtMs;
      if (this.exposure >= SEARCHLIGHT.catchMs) {
        this.wantsFighter = true;
        this.exposure = 0;
        this.cooldown = SEARCHLIGHT.cooldownMs;
      }
    } else {
      this.exposure = Math.max(0, this.exposure - dtMs * SEARCHLIGHT.decayRate);
    }
  }

  /** Game calls this; true exactly once per lock, then spawns a fighter. */
  takeFighterRequest(): boolean {
    if (!this.wantsFighter) return false;
    this.wantsFighter = false;
    return true;
  }

  draw(ctx: CanvasRenderingContext2D): void {
    const c = this.centerAngle;
    const half = SEARCHLIGHT.halfAngleDeg * DEG;
    const dir = (a: number) => ({ x: Math.sin(a), y: -Math.cos(a) });
    const l = dir(c - half);
    const r = dir(c + half);

    // Cone fill, brightening as the lock builds.
    const lockA = 0.08 + 0.16 * this.lockProgress;
    const g = ctx.createLinearGradient(this.ox, this.oy, this.ox + dir(c).x * CONE_LEN, this.oy + dir(c).y * CONE_LEN);
    g.addColorStop(0, `rgba(${SEARCHLIGHT.beam},${lockA + 0.1})`);
    g.addColorStop(1, `rgba(${SEARCHLIGHT.beam},0)`);
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.moveTo(this.ox, this.oy);
    ctx.lineTo(this.ox + l.x * CONE_LEN, this.oy + l.y * CONE_LEN);
    ctx.lineTo(this.ox + r.x * CONE_LEN, this.oy + r.y * CONE_LEN);
    ctx.closePath();
    ctx.fill();

    // Lamp glow at the base.
    ctx.fillStyle = `rgba(${SEARCHLIGHT.beam},0.8)`;
    ctx.beginPath();
    ctx.arc(this.ox, this.oy, 4 + 2 * this.lockProgress, 0, Math.PI * 2);
    ctx.fill();
  }
}
