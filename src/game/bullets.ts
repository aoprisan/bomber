import { UPGRADES, WORLD } from "./tuning";

/**
 * Tail-gunner bullet. Fired from the bomber toward a night fighter; travels in
 * a straight line and is retired on impact or when it leaves the field. Pooled.
 */
export class Bullet {
  x = 0;
  y = 0;
  private vx = 0;
  private vy = 0;

  /** Aim from (x,y) toward (tx,ty). */
  spawn(x: number, y: number, tx: number, ty: number): void {
    this.x = x;
    this.y = y;
    const dx = tx - x;
    const dy = ty - y;
    const len = Math.hypot(dx, dy) || 1;
    const s = UPGRADES.tailgun.bulletSpeed;
    this.vx = (dx / len) * s;
    this.vy = (dy / len) * s;
  }

  get offscreen(): boolean {
    return (
      this.y < -20 || this.y > WORLD.height + 20 || this.x < -20 || this.x > WORLD.width + 20
    );
  }

  /** dt in seconds. */
  update(dt: number): void {
    this.x += this.vx * dt;
    this.y += this.vy * dt;
  }

  draw(ctx: CanvasRenderingContext2D): void {
    const r = UPGRADES.tailgun.bulletRadius;
    ctx.fillStyle = UPGRADES.tailgun.color;
    ctx.beginPath();
    ctx.arc(this.x, this.y, r, 0, Math.PI * 2);
    ctx.fill();
    // Short tracer tail.
    ctx.strokeStyle = "rgba(159,232,255,0.5)";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(this.x, this.y);
    ctx.lineTo(this.x - this.vx * 0.02, this.y - this.vy * 0.02);
    ctx.stroke();
  }
}
