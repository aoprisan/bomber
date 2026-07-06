import { PointerInput } from "../engine/input";
import { Pool } from "../engine/pool";
import { Sfx } from "../engine/sfx";
import { Bullet } from "./bullets";
import { Particle } from "./particles";
import { Explosion, ScorePopup } from "./effects";
import { Bomber, clamp } from "./entities";
import { Renderer, Scene } from "./render";
import { Spawner } from "./spawner";
import { Target } from "./targets";
import { Balloon } from "./threats/balloon";
import { Fighter } from "./threats/fighter";
import { Flak } from "./threats/flak";
import { Searchlight } from "./threats/searchlight";
import { Tracer } from "./threats/tracer";
import {
  BALLOON,
  BOMB,
  EXPLOSION,
  FIGHTER,
  FLAK,
  INPUT,
  PARTICLE,
  SCORING,
  SCROLL,
  SHAKE,
  SPAWN,
  TRACER,
  UPGRADES,
} from "./tuning";
import {
  createMods,
  isMaxed,
  resetMods,
  rollChoices,
  UpgradeDef,
  UpgradeKey,
  UpgradeMods,
  upgradeByKey,
} from "./upgrades";

export type Phase = "playing" | "upgrade" | "over";

export interface RunStats {
  timeMs: number;
  hitsTaken: number;
  score: number;
  targetsHit: number;
  bestCombo: number;
  segment: number;
}

export interface GameCallbacks {
  onGameOver(stats: RunStats): void;
  /** A segment cleared; offer one of these upgrades (segment is 1-based). */
  onUpgrade(choices: readonly UpgradeDef[], segment: number): void;
  /** The bomber took damage (for the hit vignette). */
  onDamage(): void;
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

  /** Roguelite state. */
  readonly mods: UpgradeMods = createMods();
  segment = 0;
  private nextSegmentMs = UPGRADES.segmentMs;
  private tailgunTimer = 0;

  private readonly flak = new Pool<Flak>(SPAWN.maxFlak, () => new Flak(), () => {});
  private readonly targets = new Pool<Target>(SPAWN.maxTargets, () => new Target(), () => {});
  private readonly tracers = new Pool<Tracer>(SPAWN.maxTracers, () => new Tracer(), () => {});
  private readonly balloons = new Pool<Balloon>(SPAWN.maxBalloons, () => new Balloon(), () => {});
  private readonly searchlights = new Pool<Searchlight>(
    SPAWN.maxSearchlights,
    () => new Searchlight(),
    () => {},
  );
  private readonly fighters = new Pool<Fighter>(SPAWN.maxFighters, () => new Fighter(), () => {});
  private readonly bullets = new Pool<Bullet>(
    UPGRADES.tailgun.maxBullets,
    () => new Bullet(),
    () => {},
  );
  private readonly particles = new Pool<Particle>(
    PARTICLE.max,
    () => new Particle(),
    () => {},
  );
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
  private exhaustTimer = 0;
  /** Current screen-shake magnitude (world units), decays over time. */
  private shakeMag = 0;

  constructor(
    private readonly input: PointerInput,
    private readonly renderer: Renderer,
    private readonly sfx: Sfx,
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
    this.tracers.clear();
    this.balloons.clear();
    this.searchlights.clear();
    this.fighters.clear();
    this.bullets.clear();
    this.particles.clear();
    this.explosions.clear();
    this.popups.clear();
    this.spawner.reset();
    this.exhaustTimer = 0;
    this.shakeMag = 0;
    this.scrollY = 0;
    this.elapsedMs = 0;
    this.hitsTaken = 0;
    this.score = 0;
    this.targetsHit = 0;
    this.comboHits = 0;
    this.bestCombo = 0;
    this.nudge = 0;
    this.segment = 0;
    this.nextSegmentMs = UPGRADES.segmentMs;
    this.tailgunTimer = 0;
    resetMods(this.mods);
    this.phase = "playing";
    this.input.poll();
  }

  /** Apply the chosen upgrade and resume the raid. Called by the UI. */
  chooseUpgrade(key: UpgradeKey): void {
    if (this.phase !== "upgrade") return;
    if (!isMaxed(this.mods, key)) {
      this.mods.levels[key]++;
      upgradeByKey(key).apply(this.bomber, this.mods);
    }
    this.sfx.upgrade();
    this.nextSegmentMs += UPGRADES.segmentMs;
    this.phase = "playing";
    this.input.poll();
  }

  private enterUpgrade(): void {
    this.segment++;
    // Self-sealing tanks repair on surviving a segment.
    if (this.mods.regenLevel > 0) {
      this.bomber.heal(this.mods.regenLevel * UPGRADES.tanks.hpPerLevelPerSegment);
    }
    const choices = rollChoices(this.mods);
    if (choices.length === 0) {
      // Everything maxed — nothing to offer; keep flying.
      this.nextSegmentMs += UPGRADES.segmentMs;
      return;
    }
    this.phase = "upgrade";
    this.cb.onUpgrade(choices, this.segment);
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

    // Raid segment boundary -> offer upgrades (freezes the sim if it opens one).
    if (this.elapsedMs >= this.nextSegmentMs) {
      this.enterUpgrade();
      if (this.phase !== "playing") return;
    }

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
    for (const req of batch.tracers) {
      const t = this.tracers.spawn();
      if (t) t.spawn(req.ox, req.a0, req.a1);
    }
    for (const req of batch.balloons) {
      const bl = this.balloons.spawn();
      if (bl) bl.spawn(req.x, req.y);
    }
    for (const req of batch.searchlights) {
      const s = this.searchlights.spawn();
      if (s) s.spawn(req.ox, req.baseAngle);
    }

    const { x: bx, y: by, radius: br } = this.bomber;

    // Engine exhaust trail behind the bomber.
    this.exhaustTimer -= dtMs;
    while (this.exhaustTimer <= 0) {
      this.exhaustTimer += PARTICLE.exhaustEveryMs;
      this.emit(bx + (Math.random() - 0.5) * 6, by + this.bomber.radius, (Math.random() - 0.5) * 20, 60 + Math.random() * 40, 260, 2.2, [120, 170, 255], 0);
    }

    this.flak.forEach((f) => {
      f.update(dtMs);
      if (f.consumeBlastStarted()) {
        this.sfx.flakThump();
        this.emitBurst(f.x, f.y, 10, 150, 420, [255, 150, 60]);
      }
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

    this.tracers.forEach((t) => {
      t.update(dtMs);
      if (t.dead) return true;
      if (t.hitsBomber(bx, by, br)) this.hitBomber(TRACER.damage);
      return false;
    });

    this.balloons.forEach((bl) => {
      bl.advance(dScroll);
      if (bl.offscreen) return true;
      if (bl.hitsBomber(bx, by, br)) this.hitBomber(BALLOON.damage);
      return false;
    });

    this.searchlights.forEach((s) => {
      s.update(dtMs, bx, by);
      if (s.takeFighterRequest()) {
        const ft = this.fighters.spawn();
        if (ft) ft.spawn(bx); // strafe the lane where we were caught
        this.sfx.lock();
      }
      return s.dead;
    });

    this.fighters.forEach((ft) => {
      ft.update(dtMs);
      if (ft.dead) return true;
      if (ft.hitsBomber(bx, by, br)) {
        if (this.mods.flares > 0) {
          // Decoy flare negates the attack and downs the fighter.
          this.mods.flares--;
          ft.damage(999);
          this.spawnPopup(bx, by - 24, "FLARE!");
        } else {
          this.hitBomber(FIGHTER.damage);
        }
      }
      return false;
    });

    this.updateTailGunner(dtMs, bx, by);

    this.bullets.forEach((b) => {
      b.update(dt);
      if (b.offscreen) return true;
      return this.bulletHitsFighter(b);
    });

    this.stepEffects(dtMs);
  }

  /** Fire on an interval at the nearest alive fighter, if a tail gunner is equipped. */
  private updateTailGunner(dtMs: number, bx: number, by: number): void {
    if (this.mods.tailgunLevel <= 0) return;
    if (this.tailgunTimer > 0) this.tailgunTimer -= dtMs;

    const target = this.nearestFighter();
    if (!target || this.tailgunTimer > 0) return;

    const b = this.bullets.spawn();
    if (b) b.spawn(bx, by - this.bomber.radius, target.x, target.y);
    this.sfx.shot();
    const t = UPGRADES.tailgun;
    this.tailgunTimer = Math.max(
      t.minIntervalMs,
      t.baseIntervalMs - (this.mods.tailgunLevel - 1) * t.intervalDropPerLevel,
    );
  }

  private nearestFighter(): Fighter | null {
    let best: Fighter | null = null;
    let bestD = Infinity;
    const { x: bx, y: by } = this.bomber;
    const buf = this.fighters.buffer;
    for (let i = 0; i < this.fighters.active; i++) {
      const ft = buf[i]!;
      if (!ft.alive) continue;
      const d = (ft.x - bx) ** 2 + (ft.y - by) ** 2;
      if (d < bestD) {
        bestD = d;
        best = ft;
      }
    }
    return best;
  }

  /** Returns true (release the bullet) if it struck a fighter. */
  private bulletHitsFighter(b: Bullet): boolean {
    const buf = this.fighters.buffer;
    const hitR = UPGRADES.tailgun.bulletRadius + 12;
    for (let i = 0; i < this.fighters.active; i++) {
      const ft = buf[i]!;
      if (!ft.alive) continue;
      if ((ft.x - b.x) ** 2 + (ft.y - b.y) ** 2 <= hitR * hitR) {
        if (ft.damage(UPGRADES.tailgun.damage)) {
          const e = this.explosions.spawn();
          if (e) e.spawn(ft.x, ft.y, b.x, b.y);
          this.sfx.flakThump();
          this.emitBurst(ft.x, ft.y, 12, 170, 480, [200, 220, 255]);
          this.addShake(SHAKE.fighterKill);
        }
        return true;
      }
    }
    return false;
  }

  private stepEffects(dtMs: number): void {
    const dt = dtMs / 1000;
    this.shakeMag = Math.max(0, this.shakeMag - SHAKE.decayPerSec * dt);
    this.particles.forEach((p) => {
      p.update(dt);
      return p.dead;
    });
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
    const aim = t.halfWidth + BOMB.aimTolerance + this.mods.spreadAimBonus;
    if (Math.abs(t.x - this.bomber.x) > aim) return;
    this.bombTarget(t);

    // Wide bomb spread: splash un-bombed neighbors near the impact.
    if (this.mods.spreadSplashX > 0) {
      const buf = this.targets.buffer;
      for (let i = 0; i < this.targets.active; i++) {
        const n = buf[i]!;
        if (n === t || n.bombed) continue;
        if (Math.abs(n.x - t.x) <= this.mods.spreadSplashX && Math.abs(n.y - t.y) <= 40) {
          this.bombTarget(n);
        }
      }
    }
  }

  private bombTarget(t: Target): void {
    t.bombed = true;
    this.comboHits++;
    if (this.comboHits > this.bestCombo) this.bestCombo = this.comboHits;
    this.targetsHit++;

    const mult = this.multiplier;
    const points = t.score * mult;
    this.score += points;

    const e = this.explosions.spawn();
    if (e) e.spawn(t.x, t.y, this.bomber.x, this.bomber.y);
    this.spawnPopup(t.x, t.y, mult > 1 ? `+${points} x${mult}` : `+${points}`);
    this.sfx.bombDrop();
    this.emitBurst(t.x, t.y, 14, 190, 520, [255, 190, 90]);
    this.addShake(SHAKE.bomb);
  }

  private spawnPopup(x: number, y: number, text: string): void {
    const p = this.popups.spawn();
    if (p) p.spawn(x, y, text);
  }

  private collideFlak(f: Flak): void {
    if (f.hasHit || f.damageRadius <= 0 || this.bomber.invulnerable) return;
    const dx = f.x - this.bomber.x;
    const dy = f.y - this.bomber.y;
    const reach = f.damageRadius + this.bomber.radius * 0.4;
    if (dx * dx + dy * dy > reach * reach) return;
    if (this.hitBomber(FLAK.damage)) f.hasHit = true;
  }

  /** Apply damage to the bomber; returns true if it landed (respects i-frames). */
  private hitBomber(dmg: number): boolean {
    if (!this.bomber.takeDamage(dmg)) return false;
    this.hitsTaken++;
    this.comboHits = 0; // taking damage breaks the combo
    this.sfx.hit();
    this.emitBurst(this.bomber.x, this.bomber.y, 16, 220, 460, [255, 90, 70]);
    this.addShake(SHAKE.hit);
    this.cb.onDamage();
    if (this.bomber.hp <= 0) this.endRun();
    return true;
  }

  // ---- Particles + screen shake ----------------------------------------

  private emit(
    x: number,
    y: number,
    vx: number,
    vy: number,
    lifeMs: number,
    size: number,
    color: readonly [number, number, number],
    gravityScale = 1,
  ): void {
    const p = this.particles.spawn();
    if (p) p.spawn(x, y, vx, vy, lifeMs, size, color, gravityScale);
  }

  /** Radial spray of `count` particles from (x,y). */
  private emitBurst(
    x: number,
    y: number,
    count: number,
    speed: number,
    lifeMs: number,
    color: readonly [number, number, number],
  ): void {
    for (let i = 0; i < count; i++) {
      const a = Math.random() * Math.PI * 2;
      const s = speed * (0.3 + Math.random() * 0.7);
      this.emit(x, y, Math.cos(a) * s, Math.sin(a) * s, lifeMs * (0.6 + Math.random() * 0.4), 1.5 + Math.random() * 2, color, 0.6);
    }
  }

  private addShake(mag: number): void {
    this.shakeMag = Math.min(SHAKE.max, this.shakeMag + mag);
  }

  private endRun(): void {
    this.phase = "over";
    this.cb.onGameOver({
      timeMs: this.elapsedMs,
      hitsTaken: this.hitsTaken,
      score: this.score,
      targetsHit: this.targetsHit,
      bestCombo: this.bestCombo,
      segment: this.segment + 1,
    });
  }

  render(alpha: number): void {
    const scene: Scene = {
      bomber: this.bomber,
      flak: this.flak.buffer,
      flakCount: this.flak.active,
      targets: this.targets.buffer,
      targetCount: this.targets.active,
      tracers: this.tracers.buffer,
      tracerCount: this.tracers.active,
      balloons: this.balloons.buffer,
      balloonCount: this.balloons.active,
      searchlights: this.searchlights.buffer,
      searchlightCount: this.searchlights.active,
      fighters: this.fighters.buffer,
      fighterCount: this.fighters.active,
      bullets: this.bullets.buffer,
      bulletCount: this.bullets.active,
      particles: this.particles.buffer,
      particleCount: this.particles.active,
      explosions: this.explosions.buffer,
      explosionCount: this.explosions.active,
      popups: this.popups.buffer,
      popupCount: this.popups.active,
      scrollY: this.scrollY,
      showReticle: this.phase === "playing",
      shakeX: this.shakeMag ? (Math.random() * 2 - 1) * this.shakeMag : 0,
      shakeY: this.shakeMag ? (Math.random() * 2 - 1) * this.shakeMag : 0,
    };
    this.renderer.draw(scene, alpha);
    this.inputConsumedThisFrame = false;
  }
}
