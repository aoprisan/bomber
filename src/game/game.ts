import { PointerInput } from "../engine/input";
import { Pool } from "../engine/pool";
import { Bomber, clamp } from "./entities";
import { Renderer, Scene } from "./render";
import { Spawner } from "./spawner";
import { Flak } from "./threats/flak";
import { FLAK, INPUT, SCROLL, SPAWN } from "./tuning";

export type Phase = "playing" | "over";

export interface RunStats {
  /** Time survived this run, milliseconds. */
  timeMs: number;
  /** Number of flak hits taken. */
  hitsTaken: number;
}

export interface GameCallbacks {
  /** Fired once when the run ends. */
  onGameOver(stats: RunStats): void;
}

/**
 * Top-level game state + simulation.
 *   M1: bomber steered by relative drag, scrolling world.
 *   M2: flak bursts with telegraphs, HP/damage, run-over.
 */
export class Game {
  readonly bomber = new Bomber();
  scrollY = 0;
  phase: Phase = "playing";
  elapsedMs = 0;
  hitsTaken = 0;

  private readonly flak = new Pool<Flak>(
    SPAWN.maxFlak,
    () => new Flak(),
    () => {},
  );
  private readonly spawner = new Spawner();

  private nudge = 0;
  private inputConsumedThisFrame = false;

  constructor(
    private readonly input: PointerInput,
    private readonly renderer: Renderer,
    private readonly cb: GameCallbacks,
  ) {}

  restart(): void {
    this.bomber.reset();
    this.flak.clear();
    this.spawner.reset();
    this.scrollY = 0;
    this.elapsedMs = 0;
    this.hitsTaken = 0;
    this.nudge = 0;
    this.phase = "playing";
    this.input.poll(); // discard any drag accumulated on the menu
  }

  update(dtMs: number): void {
    if (this.phase !== "playing") {
      this.input.poll(); // keep input drained so it can't leak into next run
      return;
    }

    const dt = dtMs / 1000;
    this.elapsedMs += dtMs;

    this.applyInput();

    // Nudge relaxes back to neutral cruise.
    this.nudge -= this.nudge * clamp(SCROLL.nudgeDecay * dt, 0, 1);

    this.bomber.update(dt);
    this.scrollY += SCROLL.baseSpeed * (1 + this.nudge) * dt;

    // Spawn + advance + collide flak.
    for (const req of this.spawner.update(dtMs)) {
      const f = this.flak.spawn();
      if (f) f.spawn(req.x, req.y);
    }
    this.flak.forEach((f) => {
      f.update(dtMs);
      if (f.dead) return true; // release
      this.collideFlak(f);
      return false;
    });
  }

  private applyInput(): void {
    if (this.inputConsumedThisFrame) return;
    this.inputConsumedThisFrame = true;
    const drag = this.input.poll();
    this.bomber.targetX += drag.dx * INPUT.dragGain;
    this.nudge += -drag.dy * SCROLL.nudgePerUnit;
    this.nudge = clamp(this.nudge, -SCROLL.nudgeRange, SCROLL.nudgeRange);
  }

  private collideFlak(f: Flak): void {
    if (f.hasHit || f.damageRadius <= 0 || this.bomber.invulnerable) return;
    const dx = f.x - this.bomber.x;
    const dy = f.y - this.bomber.y;
    // Treat the plane as a small disc for fairer grazing.
    const reach = f.damageRadius + this.bomber.radius * 0.4;
    if (dx * dx + dy * dy > reach * reach) return;

    if (this.bomber.takeDamage(FLAK.damage)) {
      f.hasHit = true;
      this.hitsTaken++;
      if (this.bomber.hp <= 0) this.endRun();
    }
  }

  private endRun(): void {
    this.phase = "over";
    this.cb.onGameOver({ timeMs: this.elapsedMs, hitsTaken: this.hitsTaken });
  }

  render(alpha: number): void {
    const scene: Scene = {
      bomber: this.bomber,
      flak: this.flak.buffer,
      flakCount: this.flak.active,
      scrollY: this.scrollY,
    };
    this.renderer.draw(scene, alpha);
    this.inputConsumedThisFrame = false;
  }
}
