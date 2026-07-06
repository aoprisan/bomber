import { clamp } from "./entities";
import { BALLOON, DIFFICULTY, FLAK, SPAWN, TARGET, TRACER, WORLD } from "./tuning";

const DEG = Math.PI / 180;

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

export interface TracerRequest {
  ox: number;
  a0: number;
  a1: number;
}

export interface BalloonRequest {
  x: number;
  y: number;
}

export interface SearchlightRequest {
  ox: number;
  baseAngle: number;
}

/** Everything the director wants to spawn this step. */
export interface SpawnBatch {
  flak: BurstRequest[];
  targets: TargetRequest[];
  tracers: TracerRequest[];
  balloons: BalloonRequest[];
  searchlights: SearchlightRequest[];
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
  private nextTracerMs: number = SPAWN.tracerStartDelayMs;
  private nextBalloonMs: number = SPAWN.balloonStartDelayMs;
  private nextSearchlightMs: number = SPAWN.searchlightStartDelayMs;

  reset(): void {
    this.elapsedMs = 0;
    this.nextFlakMs = SPAWN.flakStartDelayMs;
    this.nextTargetMs = SPAWN.targetStartDelayMs;
    this.nextTracerMs = SPAWN.tracerStartDelayMs;
    this.nextBalloonMs = SPAWN.balloonStartDelayMs;
    this.nextSearchlightMs = SPAWN.searchlightStartDelayMs;
  }

  /** Advance time; return everything to spawn this step. */
  update(dtMs: number): SpawnBatch {
    this.elapsedMs += dtMs;
    const batch: SpawnBatch = {
      flak: [],
      targets: [],
      tracers: [],
      balloons: [],
      searchlights: [],
    };

    if (this.elapsedMs >= this.nextFlakMs) {
      batch.flak.push(this.randomBurst());
      // Difficulty ramp: occasionally fire a second burst as the raid heats up.
      if (Math.random() < this.doubleChance()) batch.flak.push(this.randomBurst());
      this.nextFlakMs = this.elapsedMs + this.currentInterval();
    }

    if (this.elapsedMs >= this.nextTargetMs) {
      batch.targets.push(this.randomTarget());
      this.nextTargetMs =
        this.elapsedMs + SPAWN.targetGapMs + Math.random() * SPAWN.targetGapJitterMs;
    }

    const scale = this.gapScale();

    if (this.elapsedMs >= this.nextTracerMs) {
      batch.tracers.push(this.randomTracer());
      this.nextTracerMs =
        this.elapsedMs + (SPAWN.tracerGapMs + Math.random() * SPAWN.tracerGapJitterMs) * scale;
    }

    if (this.elapsedMs >= this.nextBalloonMs) {
      batch.balloons.push(this.randomBalloon());
      this.nextBalloonMs =
        this.elapsedMs + (SPAWN.balloonGapMs + Math.random() * SPAWN.balloonGapJitterMs) * scale;
    }

    if (this.elapsedMs >= this.nextSearchlightMs) {
      batch.searchlights.push(this.randomSearchlight());
      this.nextSearchlightMs =
        this.elapsedMs +
        (SPAWN.searchlightGapMs + Math.random() * SPAWN.searchlightGapJitterMs) * scale;
    }

    return batch;
  }

  /** Difficulty curve: threat gaps shrink toward minGapScale over the raid. */
  private gapScale(): number {
    const t = clamp(this.elapsedMs / DIFFICULTY.rampMs, 0, 1);
    return 1 + (DIFFICULTY.minGapScale - 1) * t;
  }

  private randomTracer(): TracerRequest {
    const ox = WORLD.width * (0.2 + Math.random() * 0.6);
    const center = (Math.random() * 2 - 1) * 22 * DEG;
    const half = (TRACER.sweepDeg * DEG) / 2;
    // Sweep in a random direction.
    return Math.random() < 0.5
      ? { ox, a0: center - half, a1: center + half }
      : { ox, a0: center + half, a1: center - half };
  }

  private randomBalloon(): BalloonRequest {
    const pad = BALLOON.edgePad;
    const x = pad + Math.random() * (WORLD.width - pad * 2);
    return { x, y: -BALLOON.radius * 2 };
  }

  private randomSearchlight(): SearchlightRequest {
    const ox = WORLD.width * (0.2 + Math.random() * 0.6);
    const baseAngle = (Math.random() * 2 - 1) * 10 * DEG;
    return { ox, baseAngle };
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
