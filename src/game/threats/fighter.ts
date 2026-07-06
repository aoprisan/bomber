import { clamp } from "../entities";
import { FIGHTER, WORLD } from "../tuning";

type Phase = "telegraph" | "strafe" | "fade" | "dead";

/**
 * Night fighter summoned by a searchlight lock. Telegraphs a vertical strafing
 * lane, then dives down it firing. The lane is hot during the strafe; dodge by
 * sliding your x off the lane. Killable (1 HP) for the M5 tail-gunner upgrade.
 */
export class Fighter {
  laneX = 0;
  age = 0;
  hp = FIGHTER.hp;
  private killed = false;

  spawn(laneX: number): void {
    this.laneX = laneX;
    this.age = 0;
    this.hp = FIGHTER.hp;
    this.killed = false;
  }

  private get phase(): Phase {
    if (this.killed) return "dead";
    if (this.age >= FIGHTER.telegraphMs + FIGHTER.strafeMs + FIGHTER.fadeMs) return "dead";
    if (this.age >= FIGHTER.telegraphMs + FIGHTER.strafeMs) return "fade";
    if (this.age >= FIGHTER.telegraphMs) return "strafe";
    return "telegraph";
  }

  get dead(): boolean {
    return this.phase === "dead";
  }

  get alive(): boolean {
    return !this.killed && !this.dead;
  }

  /** Apply damage (tail gunner). Returns true if this shot killed it. */
  damage(dmg: number): boolean {
    if (this.killed) return false;
    this.hp -= dmg;
    if (this.hp <= 0) {
      this.killed = true;
      return true;
    }
    return false;
  }

  /** Horizontal position (the strafe lane). */
  get x(): number {
    return this.laneX;
  }

  /** Vertical position of the fighter sprite. */
  get y(): number {
    if (this.phase === "telegraph") return -18;
    const t = clamp((this.age - FIGHTER.telegraphMs) / FIGHTER.strafeMs, 0, 1);
    return -18 + t * (WORLD.height + 36);
  }

  update(dtMs: number): void {
    this.age += dtMs;
  }

  hitsBomber(bx: number, _by: number, radius: number): boolean {
    if (this.phase !== "strafe") return false;
    return Math.abs(bx - this.laneX) < FIGHTER.laneHalfWidth + radius * 0.3;
  }

  draw(ctx: CanvasRenderingContext2D): void {
    const phase = this.phase;
    const x = this.laneX;

    if (phase === "telegraph") {
      const k = this.age / FIGHTER.telegraphMs;
      ctx.globalAlpha = 0.4 + 0.4 * (0.5 - 0.5 * Math.cos(k * Math.PI * 6));
      ctx.strokeStyle = FIGHTER.tracer;
      ctx.lineWidth = 2;
      ctx.setLineDash([7, 9]);
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, WORLD.height);
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.globalAlpha = 1;
      this.drawShip(ctx, x, this.y, 0.6);
      return;
    }

    const alpha =
      phase === "fade"
        ? 1 - (this.age - FIGHTER.telegraphMs - FIGHTER.strafeMs) / FIGHTER.fadeMs
        : 1;
    ctx.globalAlpha = clamp(alpha, 0, 1);

    if (phase === "strafe") {
      // Hot lane.
      ctx.strokeStyle = "rgba(255,90,60,0.5)";
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, WORLD.height);
      ctx.stroke();
      // Tracer rounds streaking ahead (below) the fighter.
      ctx.fillStyle = FIGHTER.tracer;
      const y = this.y;
      for (let i = 1; i <= 4; i++) {
        ctx.beginPath();
        ctx.arc(x, y + i * 22, 2.2, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    this.drawShip(ctx, x, this.y, 1);
    ctx.globalAlpha = 1;
  }

  private drawShip(ctx: CanvasRenderingContext2D, x: number, y: number, scale: number): void {
    ctx.save();
    ctx.translate(x, y);
    ctx.scale(scale, scale);
    ctx.fillStyle = FIGHTER.body;
    // Nose-down interceptor silhouette.
    ctx.beginPath();
    ctx.moveTo(0, 16);
    ctx.lineTo(7, -6);
    ctx.lineTo(3, -12);
    ctx.lineTo(-3, -12);
    ctx.lineTo(-7, -6);
    ctx.closePath();
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(-16, -4);
    ctx.lineTo(16, -4);
    ctx.lineTo(10, -9);
    ctx.lineTo(-10, -9);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }
}
