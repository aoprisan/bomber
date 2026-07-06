import { BALLOON, GROUND, WORLD } from "../tuning";

const GROUND_TOP = WORLD.height * (1 - GROUND.bandHeight);

/**
 * Barrage balloon: a static blimp that scrolls down with a taut cable to the
 * ground. The balloon body and the full length of its cable are hazards, so
 * the whole x-lane is blocked while it passes — forcing lane choices.
 */
export class Balloon {
  x = 0;
  y = 0;

  spawn(x: number, y: number): void {
    this.x = x;
    this.y = y;
  }

  advance(dScroll: number): void {
    this.y += dScroll;
  }

  get offscreen(): boolean {
    return this.y - BALLOON.radius > WORLD.height;
  }

  hitsBomber(bx: number, by: number, radius: number): boolean {
    // Balloon body (circle-circle).
    const dx = bx - this.x;
    const dy = by - this.y;
    const rr = BALLOON.radius + radius;
    if (dx * dx + dy * dy < rr * rr) return true;

    // Cable: vertical segment from the balloon down to the ground.
    if (by >= this.y && by <= GROUND_TOP) {
      if (Math.abs(bx - this.x) < BALLOON.cableHalfWidth + radius * 0.3) return true;
    }
    return false;
  }

  draw(ctx: CanvasRenderingContext2D): void {
    // Cable to ground.
    ctx.strokeStyle = BALLOON.cable;
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(this.x, this.y);
    ctx.lineTo(this.x, GROUND_TOP);
    ctx.stroke();

    const r = BALLOON.radius;
    // Body: a vertical blimp.
    ctx.fillStyle = BALLOON.body;
    ctx.beginPath();
    ctx.ellipse(this.x, this.y, r * 0.8, r, 0, 0, Math.PI * 2);
    ctx.fill();
    // Highlight.
    ctx.fillStyle = BALLOON.bodyLight;
    ctx.beginPath();
    ctx.ellipse(this.x - r * 0.25, this.y - r * 0.2, r * 0.28, r * 0.5, 0, 0, Math.PI * 2);
    ctx.fill();
    // Tail fins.
    ctx.fillStyle = BALLOON.body;
    ctx.beginPath();
    ctx.moveTo(this.x, this.y + r);
    ctx.lineTo(this.x - r * 0.5, this.y + r * 1.35);
    ctx.lineTo(this.x + r * 0.5, this.y + r * 1.35);
    ctx.closePath();
    ctx.fill();
    // Outline.
    ctx.strokeStyle = "rgba(255,255,255,0.10)";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.ellipse(this.x, this.y, r * 0.8, r, 0, 0, Math.PI * 2);
    ctx.stroke();
  }
}
