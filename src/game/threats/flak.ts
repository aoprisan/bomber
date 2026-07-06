import { clamp } from "../entities";
import { FLAK, GROUND, WORLD } from "../tuning";

type Phase = "telegraph" | "expand" | "linger" | "fade" | "dead";

/**
 * A single flak burst. Time-driven lifecycle (see FLAK in tuning): a ground
 * muzzle flash marks the target point, a reticle grows during the telegraph
 * window, then the blast punches out, dwells, and fades. It damages while the
 * blast is expanding or lingering and the bomber is inside the blast core.
 */
export class Flak {
  x = 0;
  y = 0;
  age = 0;
  /** Set true once this burst has landed a hit, so it can't double-dip. */
  hasHit = false;
  private blastAnnounced = false;

  /** Reinitialize for reuse from the pool at a new target point. */
  spawn(x: number, y: number): void {
    this.x = x;
    this.y = y;
    this.age = 0;
    this.hasHit = false;
    this.blastAnnounced = false;
  }

  /** True exactly once, on the frame the blast first goes off (for sfx/particles). */
  consumeBlastStarted(): boolean {
    if (this.blastAnnounced || this.age < FLAK.telegraphMs) return false;
    this.blastAnnounced = true;
    return true;
  }

  private get t0(): number {
    return FLAK.telegraphMs;
  }
  private get t1(): number {
    return this.t0 + FLAK.expandMs;
  }
  private get t2(): number {
    return this.t1 + FLAK.lingerMs;
  }
  private get t3(): number {
    return this.t2 + FLAK.fadeMs;
  }

  get phase(): Phase {
    if (this.age >= this.t3) return "dead";
    if (this.age >= this.t2) return "fade";
    if (this.age >= this.t1) return "linger";
    if (this.age >= this.t0) return "expand";
    return "telegraph";
  }

  get dead(): boolean {
    return this.age >= this.t3;
  }

  /** Current visual blast radius (world units); 0 until the blast begins. */
  get radius(): number {
    const p = this.phase;
    if (p === "telegraph") return 0;
    if (p === "expand") {
      const k = (this.age - this.t0) / FLAK.expandMs;
      return FLAK.blastRadius * easeOutBack(k);
    }
    return FLAK.blastRadius; // linger + fade hold full size (fade dims alpha)
  }

  /** Radius within which the bomber takes damage right now (0 if harmless). */
  get damageRadius(): number {
    const p = this.phase;
    if (p !== "expand" && p !== "linger") return 0;
    return this.radius * FLAK.coreFraction;
  }

  update(dtMs: number): void {
    this.age += dtMs;
  }

  draw(ctx: CanvasRenderingContext2D): void {
    const p = this.phase;
    if (p === "telegraph") this.drawTelegraph(ctx);
    else this.drawBlast(ctx, p);
  }

  private drawTelegraph(ctx: CanvasRenderingContext2D): void {
    const k = clamp(this.age / FLAK.telegraphMs, 0, 1);
    const groundTop = WORLD.height * (1 - GROUND.bandHeight);

    // Muzzle flash on the ground directly below the marked point.
    const flashR = 5 + 7 * pulse(k);
    ctx.globalAlpha = 0.5 + 0.5 * pulse(k);
    ctx.fillStyle = FLAK.flash;
    ctx.beginPath();
    ctx.arc(this.x, groundTop + 4, flashR, 0, Math.PI * 2);
    ctx.fill();

    // Faint tracer from the gun to the marked point.
    ctx.globalAlpha = 0.12 + 0.18 * k;
    ctx.strokeStyle = FLAK.reticle;
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    ctx.moveTo(this.x, groundTop);
    ctx.lineTo(this.x, this.y);
    ctx.stroke();

    // Reticle: a ring that tightens toward the burst point as time runs out.
    const ringR = FLAK.reticleRadius * (1.9 - 0.9 * k);
    ctx.globalAlpha = 0.35 + 0.5 * k;
    ctx.strokeStyle = FLAK.reticle;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(this.x, this.y, ringR, 0, Math.PI * 2);
    ctx.stroke();
    // Crosshair ticks.
    ctx.beginPath();
    for (const a of [0, Math.PI / 2, Math.PI, (3 * Math.PI) / 2]) {
      ctx.moveTo(this.x + Math.cos(a) * ringR, this.y + Math.sin(a) * ringR);
      ctx.lineTo(this.x + Math.cos(a) * (ringR + 6), this.y + Math.sin(a) * (ringR + 6));
    }
    ctx.stroke();

    ctx.globalAlpha = 1;
  }

  private drawBlast(ctx: CanvasRenderingContext2D, phase: Phase): void {
    const r = this.radius;
    let alpha = 1;
    if (phase === "fade") {
      const k = (this.age - this.t2) / FLAK.fadeMs;
      alpha = 1 - clamp(k, 0, 1);
    }

    const g = ctx.createRadialGradient(this.x, this.y, 0, this.x, this.y, r);
    g.addColorStop(0, FLAK.blastInner);
    g.addColorStop(0.55, FLAK.blastOuter);
    g.addColorStop(1, "rgba(255,90,20,0)");
    ctx.globalAlpha = alpha;
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(this.x, this.y, r, 0, Math.PI * 2);
    ctx.fill();

    // Shockwave ring during the punch-out.
    if (phase === "expand" || phase === "linger") {
      ctx.globalAlpha = alpha * 0.7;
      ctx.strokeStyle = FLAK.blastInner;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(this.x, this.y, r * 0.94, 0, Math.PI * 2);
      ctx.stroke();
    }
    ctx.globalAlpha = 1;
  }
}

/** Overshoot ease for a punchy blast expansion. */
function easeOutBack(k: number): number {
  const c1 = 1.70158;
  const c3 = c1 + 1;
  const x = clamp(k, 0, 1) - 1;
  return 1 + c3 * x * x * x + c1 * x * x;
}

/** 0..1..0 pulse for the telegraph flash. */
function pulse(k: number): number {
  return 0.5 - 0.5 * Math.cos(k * Math.PI * 6);
}
