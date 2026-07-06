import { clamp, lerp } from "../entities";
import { GROUND, TRACER, WORLD } from "../tuning";

type Phase = "aim" | "fire" | "fade" | "dead";

const GROUND_TOP = WORLD.height * (1 - GROUND.bandHeight);
const BEAM_LEN = WORLD.height * 1.5;

/**
 * A sweeping AA tracer stream fired from a ground gun. Aims (dim line), then
 * goes hot and sweeps its line-of-fire across the field. Damages when the
 * bomber is within beamHalfWidth of the hot centerline.
 */
export class Tracer {
  ox = 0;
  oy = GROUND_TOP;
  private a0 = 0;
  private a1 = 0;
  age = 0;

  spawn(ox: number, a0: number, a1: number): void {
    this.ox = ox;
    this.oy = GROUND_TOP;
    this.a0 = a0;
    this.a1 = a1;
    this.age = 0;
  }

  private get phase(): Phase {
    if (this.age >= TRACER.aimMs + TRACER.fireMs + TRACER.fadeMs) return "dead";
    if (this.age >= TRACER.aimMs + TRACER.fireMs) return "fade";
    if (this.age >= TRACER.aimMs) return "fire";
    return "aim";
  }

  get dead(): boolean {
    return this.phase === "dead";
  }

  private get angle(): number {
    if (this.phase === "aim") return this.a0;
    if (this.phase === "fire") {
      const t = (this.age - TRACER.aimMs) / TRACER.fireMs;
      return lerp(this.a0, this.a1, clamp(t, 0, 1));
    }
    return this.a1;
  }

  update(dtMs: number): void {
    this.age += dtMs;
  }

  /** Beam direction (unit), pointing up-field from the gun. */
  private dir(): { x: number; y: number } {
    const a = this.angle;
    return { x: Math.sin(a), y: -Math.cos(a) };
  }

  hitsBomber(bx: number, by: number, radius: number): boolean {
    if (this.phase !== "fire") return false;
    const d = this.dir();
    const vx = bx - this.ox;
    const vy = by - this.oy;
    const along = vx * d.x + vy * d.y;
    if (along < 0) return false; // behind the gun
    const perp = Math.abs(vx * d.y - vy * d.x);
    return perp < TRACER.beamHalfWidth + radius * 0.4;
  }

  draw(ctx: CanvasRenderingContext2D): void {
    const phase = this.phase;
    const d = this.dir();
    const ex = this.ox + d.x * BEAM_LEN;
    const ey = this.oy + d.y * BEAM_LEN;

    if (phase === "aim") {
      ctx.strokeStyle = TRACER.colorAim;
      ctx.lineWidth = 2;
      ctx.setLineDash([6, 8]);
      ctx.beginPath();
      ctx.moveTo(this.ox, this.oy);
      ctx.lineTo(ex, ey);
      ctx.stroke();
      ctx.setLineDash([]);
      return;
    }

    const alpha = phase === "fade" ? 1 - (this.age - TRACER.aimMs - TRACER.fireMs) / TRACER.fadeMs : 1;
    ctx.globalAlpha = clamp(alpha, 0, 1);

    // Hot beam core.
    ctx.strokeStyle = TRACER.colorHot;
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(this.ox, this.oy);
    ctx.lineTo(ex, ey);
    ctx.stroke();

    // Traveling tracer rounds along the beam.
    if (phase === "fire") {
      ctx.fillStyle = TRACER.tracer;
      const flow = (this.age % 260) / 260;
      for (let i = 0; i < 6; i++) {
        const t = ((i / 6 + flow) % 1) * 0.85 + 0.05;
        const px = this.ox + d.x * BEAM_LEN * t;
        const py = this.oy + d.y * BEAM_LEN * t;
        ctx.beginPath();
        ctx.arc(px, py, 2.4, 0, Math.PI * 2);
        ctx.fill();
      }
      // Muzzle glow.
      ctx.beginPath();
      ctx.arc(this.ox, this.oy, 5, 0, Math.PI * 2);
      ctx.fill();
    }

    ctx.globalAlpha = 1;
  }
}
