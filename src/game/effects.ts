import { clamp } from "./entities";
import { BOMB, EXPLOSION, SCORING } from "./tuning";

/**
 * Bomb-impact explosion: a brief drop streak from the bomber to the impact
 * point, then an expanding flash + shockwave ring. Purely cosmetic (bombing
 * damage is resolved at drop time), so it only needs to age out.
 */
export class Explosion {
  x = 0;
  y = 0;
  /** Origin the bomb was dropped from, for the streak. */
  ox = 0;
  oy = 0;
  age = 0;

  spawn(x: number, y: number, ox: number, oy: number): void {
    this.x = x;
    this.y = y;
    this.ox = ox;
    this.oy = oy;
    this.age = 0;
  }

  get dead(): boolean {
    return this.age >= EXPLOSION.durationMs;
  }

  update(dtMs: number): void {
    this.age += dtMs;
  }

  draw(ctx: CanvasRenderingContext2D): void {
    const k = clamp(this.age / EXPLOSION.durationMs, 0, 1);

    // Drop streak fades out over the first slice of the explosion.
    if (this.age < BOMB.streakMs) {
      const sa = 1 - this.age / BOMB.streakMs;
      ctx.globalAlpha = sa * 0.8;
      ctx.strokeStyle = EXPLOSION.inner;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(this.ox, this.oy);
      ctx.lineTo(this.x, this.y);
      ctx.stroke();
    }

    const r = EXPLOSION.maxRadius * easeOut(k);
    const g = ctx.createRadialGradient(this.x, this.y, 0, this.x, this.y, r);
    g.addColorStop(0, EXPLOSION.inner);
    g.addColorStop(0.5, EXPLOSION.outer);
    g.addColorStop(1, "rgba(255,90,20,0)");
    ctx.globalAlpha = 1 - k;
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(this.x, this.y, r, 0, Math.PI * 2);
    ctx.fill();

    ctx.globalAlpha = (1 - k) * 0.7;
    ctx.strokeStyle = EXPLOSION.inner;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(this.x, this.y, r * 0.96, 0, Math.PI * 2);
    ctx.stroke();

    ctx.globalAlpha = 1;
  }
}

/** Floating "+150 x3" score text that rises and fades at the impact point. */
export class ScorePopup {
  x = 0;
  y = 0;
  age = 0;
  text = "";

  spawn(x: number, y: number, text: string): void {
    this.x = x;
    this.y = y;
    this.text = text;
    this.age = 0;
  }

  get dead(): boolean {
    return this.age >= SCORING.popupMs;
  }

  update(dtMs: number): void {
    this.age += dtMs;
  }

  draw(ctx: CanvasRenderingContext2D): void {
    const k = clamp(this.age / SCORING.popupMs, 0, 1);
    const y = this.y - SCORING.popupRise * easeOut(k);
    ctx.globalAlpha = 1 - k * k;
    ctx.fillStyle = SCORING.popupColor;
    ctx.font = "700 15px system-ui, sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(this.text, this.x, y);
    ctx.globalAlpha = 1;
    ctx.textAlign = "start";
    ctx.textBaseline = "alphabetic";
  }
}

function easeOut(k: number): number {
  return 1 - (1 - k) * (1 - k);
}
