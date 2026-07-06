import { PointerInput } from "../engine/input";
import { Pool } from "../engine/pool";
import { Explosion, ScorePopup } from "./effects";
import { Bomber, clamp } from "./entities";
import { Renderer, Scene } from "./render";
import { Spawner } from "./spawner";
import { Target } from "./targets";
import { Flak } from "./threats/flak";
import { BOMB, EXPLOSION, FLAK, INPUT, SCORING, SCROLL, SPAWN } from "./tuning";

export type Phase = "playing" | "over";

export interface RunStats {
  timeMs: number;
  hitsTaken: number;
  score: number;
  targetsHit: number;
  bestCombo: number;
}

export interface GameCallbacks {
  onGameOver(stats: RunStats): void;
}

/**
 * Top-level game state + simulation.
 *   M1: bomber steered by relative drag, scrolling world.
 *   M2: flak bursts with telegraphs, HP/damage, run-over.
 *   M3: scrolling targets, bombsight auto-drop, combo scoring.
 */
export class Game {
  readonly bomber = new Bomber();
  scrollY = 0;
  phase: Phase = "playing";
  elapsedMs = 0;
  hitsTaken = 0;

  score = 0;
  targetsHit = 0;
  /** Consecutive hits with no damage; drives the multiplier. */
  comboHits = 0;
  bestCombo = 0;

  private readonly flak = new Pool<Flak>(SPAWN.maxFlak, () => new Flak(), () => {});
  private readonly targets = new Pool<Target>(SPAWN.maxTargets, () => new Target(), () => {});
  private readonly explosions = new Pool<Explosion>(
    EXPLOSION.maxExplosions,
    () => new Explosion(),
    () => {},
  );
  private readonly popups = new Pool<ScorePopup>(
    EXPLOSION.maxPopups,
    () => new ScorePopup(),
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

  /** Current score multiplier from the active combo. */
  get multiplier(): number {
    return Math.min(SCORING.comboMax, 1 + Math.floor(this.comboHits / SCORING.hitsPerMultiplier));
  }

  restart(): void {
    this.bomber.reset();
    this.flak.clear();
    this.targets.clear();
    this.explosions.clear();
    this.popups.clear();
    this.spawner.reset();
    this.scrollY = 0;
    this.elapsedMs = 0;
    this.hitsTaken = 0;
    this.score = 0;
    this.targetsHit = 0;
    this.comboHits = 0;
    this.bestCombo = 0;
    this.nudge = 0;
    this.phase = "playing";
    this.input.poll();
  }

  update(dtMs: number): void {
    if (this.phase !== "playing") {
      this.input.poll();
      // Effects keep animating out on the frozen field.
      this.stepEffects(dtMs);
      return;
    }

    const dt = dtMs / 1000;
    this.elapsedMs += dtMs;

    this.applyInput();
    this.nudge -= this.nudge * clamp(SCROLL.nudgeDecay * dt, 0, 1);
    this.bomber.update(dt);

    const dScroll = SCROLL.baseSpeed * (1 + this.nudge) * dt;
    this.scrollY += dScroll;

    const batch = this.spawner.update(dtMs);
    for (const req of batch.flak) {
      const f = this.flak.spawn();
      if (f) f.spawn(req.x, req.y);
    }
    for (const req of batch.targets) {
      const t = this.targets.spawn();
      if (t) t.spawn(req.x, req.y, req.typeIndex, req.seed);
    }

    this.flak.forEach((f) => {
      f.update(dtMs);
      if (f.dead) return true;
      this.collideFlak(f);
      return false;
    });

    this.targets.forEach((t) => {
      t.advance(dScroll);
      if (t.offscreen) return true;
      if (!t.bombed) this.tryBomb(t);
      return false;
    });

    this.stepEffects(dtMs);
  }

  private stepEffects(dtMs: number): void {
    this.explosions.forEach((e) => {
      e.update(dtMs);
      return e.dead;
    });
    this.popups.forEach((p) => {
      p.update(dtMs);
      return p.dead;
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

  /** Bombsight impact point: directly ahead of (above) the plane. */
  private get reticleY(): number {
    return this.bomber.y - BOMB.leadDistance;
  }

  private tryBomb(t: Target): void {
    if (Math.abs(t.y - this.reticleY) > BOMB.dropBandHalf) return;
    if (Math.abs(t.x - this.bomber.x) > t.halfWidth + BOMB.aimTolerance) return;
    this.dropBomb(t);
  }

  private dropBomb(t: Target): void {
    t.bombed = true;
    this.comboHits++;
    if (this.comboHits > this.bestCombo) this.bestCombo = this.comboHits;
    this.targetsHit++;

    const mult = this.multiplier;
    const points = t.score * mult;
    this.score += points;

    const e = this.explosions.spawn();
    if (e) e.spawn(t.x, t.y, this.bomber.x, this.bomber.y);
    const p = this.popups.spawn();
    if (p) p.spawn(t.x, t.y, mult > 1 ? `+${points} x${mult}` : `+${points}`);
  }

  private collideFlak(f: Flak): void {
    if (f.hasHit || f.damageRadius <= 0 || this.bomber.invulnerable) return;
    const dx = f.x - this.bomber.x;
    const dy = f.y - this.bomber.y;
    const reach = f.damageRadius + this.bomber.radius * 0.4;
    if (dx * dx + dy * dy > reach * reach) return;

    if (this.bomber.takeDamage(FLAK.damage)) {
      f.hasHit = true;
      this.hitsTaken++;
      this.comboHits = 0; // taking damage breaks the combo
      if (this.bomber.hp <= 0) this.endRun();
    }
  }

  private endRun(): void {
    this.phase = "over";
    this.cb.onGameOver({
      timeMs: this.elapsedMs,
      hitsTaken: this.hitsTaken,
      score: this.score,
      targetsHit: this.targetsHit,
      bestCombo: this.bestCombo,
    });
  }

  render(alpha: number): void {
    const scene: Scene = {
      bomber: this.bomber,
      flak: this.flak.buffer,
      flakCount: this.flak.active,
      targets: this.targets.buffer,
      targetCount: this.targets.active,
      explosions: this.explosions.buffer,
      explosionCount: this.explosions.active,
      popups: this.popups.buffer,
      popupCount: this.popups.active,
      scrollY: this.scrollY,
      showReticle: this.phase === "playing",
    };
    this.renderer.draw(scene, alpha);
    this.inputConsumedThisFrame = false;
  }
}
