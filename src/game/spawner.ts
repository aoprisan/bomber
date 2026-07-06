import { clamp } from "./entities";
import { FLAK, SPAWN, TARGET, WORLD } from "./tuning";

/** Where a burst wants to appear. The game maps this into its flak pool. */
export interface BurstRequest {
  x: number;
  y: number;
}

/** A target to scroll in from above. */
export interface TargetRequest {
  x: number;
  y: number;
  typeIndex: number;
  seed: number;
}

/** Everything the director wants to spawn this step. */
export interface SpawnBatch {
  flak: BurstRequest[];
  targets: TargetRequest[];
}

/**
 * Time-based spawn director. Owns *when* threats appear and how the cadence
 * ramps with elapsed play time. It doesn't own the pools — it returns burst
 * requests the game fulfils, keeping allocation/collision in one place.
 */
export class Spawner {
  private elapsedMs = 0;
  private nextFlakMs: number = SPAWN.flakStartDelayMs;
  private nextTargetMs: number = SPAWN.targetStartDelayMs;

  reset(): void {
    this.elapsedMs = 0;
    this.nextFlakMs = SPAWN.flakStartDelayMs;
    this.nextTargetMs = SPAWN.targetStartDelayMs;
  }

  /** Advance time; return everything to spawn this step. */
  update(dtMs: number): SpawnBatch {
    this.elapsedMs += dtMs;
    const batch: SpawnBatch = { flak: [], targets: [] };

    if (this.elapsedMs >= this.nextFlakMs) {
      batch.flak.push(this.randomBurst());
      // Difficulty ramp: occasionally fire a second burst as the raid heats up.
      if (Math.random() < this.doubleChance()) batch.flak.push(this.randomBurst());
      this.nextFlakMs = this.elapsedMs + this.currentInterval();
    }

    if (this.elapsedMs >= this.nextTargetMs) {
      batch.targets.push(this.randomTarget());
      const gap = SPAWN.targetGapMs + Math.random() * SPAWN.targetGapJitterMs;
      this.nextTargetMs = this.elapsedMs + gap;
    }

    return batch;
  }

  private randomTarget(): TargetRequest {
    const typeIndex = Math.floor(Math.random() * TARGET.types.length);
    const halfW = TARGET.types[typeIndex]!.w / 2;
    const pad = TARGET.edgePad + halfW;
    const x = pad + Math.random() * (WORLD.width - pad * 2);
    return { x, y: -40, typeIndex, seed: Math.floor(Math.random() * 1000) };
  }

  /** 0..1 progress along the difficulty ramp. */
  private ramp(): number {
    return clamp(this.elapsedMs / SPAWN.flakRampMs, 0, 1);
  }

  private currentInterval(): number {
    const t = this.ramp();
    const base = SPAWN.flakIntervalMs;
    const floor = SPAWN.flakIntervalMinMs;
    const interval = base + (floor - base) * t;
    // Small jitter so bursts don't feel metronomic.
    return interval * (0.85 + Math.random() * 0.3);
  }

  private doubleChance(): number {
    const t = this.ramp();
    return SPAWN.doubleChanceStart + (SPAWN.doubleChanceEnd - SPAWN.doubleChanceStart) * t;
  }

  private randomBurst(): BurstRequest {
    const pad = FLAK.edgePad;
    const x = pad + Math.random() * (WORLD.width - pad * 2);
    const y = (FLAK.minY + Math.random() * (FLAK.maxY - FLAK.minY)) * WORLD.height;
    return { x, y };
  }
}
