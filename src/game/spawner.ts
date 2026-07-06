import { clamp } from "./entities";
import { FLAK, SPAWN, WORLD } from "./tuning";

/** Where a burst wants to appear. The game maps this into its flak pool. */
export interface BurstRequest {
  x: number;
  y: number;
}

/**
 * Time-based spawn director. Owns *when* threats appear and how the cadence
 * ramps with elapsed play time. It doesn't own the pools — it returns burst
 * requests the game fulfils, keeping allocation/collision in one place.
 */
export class Spawner {
  private elapsedMs = 0;
  private nextFlakMs: number = SPAWN.flakStartDelayMs;

  reset(): void {
    this.elapsedMs = 0;
    this.nextFlakMs = SPAWN.flakStartDelayMs;
  }

  /** Advance time; return any bursts to spawn this step. */
  update(dtMs: number): BurstRequest[] {
    this.elapsedMs += dtMs;
    const out: BurstRequest[] = [];

    if (this.elapsedMs >= this.nextFlakMs) {
      out.push(this.randomBurst());
      // Difficulty ramp: occasionally fire a second burst as the raid heats up.
      if (Math.random() < this.doubleChance()) out.push(this.randomBurst());
      this.nextFlakMs = this.elapsedMs + this.currentInterval();
    }

    return out;
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
