import { PARTICLE } from "./tuning";

/**
 * Lightweight pooled particle: sparks, debris, and engine exhaust. Fades over
 * its lifetime and is drawn additively by the renderer for a glow.
 */
export class Particle {
  x = 0;
  y = 0;
  private vx = 0;
  private vy = 0;
  private life = 0;
  private maxLife = 1;
  private size = 2;
  private gravityScale = 1;
  r = 255;
  g = 200;
  b = 120;

  spawn(
    x: number,
    y: number,
    vx: number,
    vy: number,
    lifeMs: number,
    size: number,
    color: readonly [number, number, number],
    gravityScale = 1,
  ): void {
    this.x = x;
    this.y = y;
    this.vx = vx;
    this.vy = vy;
    this.life = lifeMs;
    this.maxLife = lifeMs;
    this.size = size;
    this.gravityScale = gravityScale;
    this.r = color[0];
    this.g = color[1];
    this.b = color[2];
  }

  get dead(): boolean {
    return this.life <= 0;
  }

  /** dt in seconds. */
  update(dt: number): void {
    this.life -= dt * 1000;
    const drag = Math.max(0, 1 - PARTICLE.drag * dt);
    this.vx *= drag;
    this.vy = this.vy * drag + PARTICLE.gravity * this.gravityScale * dt;
    this.x += this.vx * dt;
    this.y += this.vy * dt;
  }

  draw(ctx: CanvasRenderingContext2D): void {
    const a = Math.max(0, this.life / this.maxLife);
    const s = this.size * (0.4 + 0.6 * a);
    ctx.fillStyle = `rgba(${this.r},${this.g},${this.b},${a})`;
    ctx.beginPath();
    ctx.arc(this.x, this.y, s, 0, Math.PI * 2);
    ctx.fill();
  }
}
