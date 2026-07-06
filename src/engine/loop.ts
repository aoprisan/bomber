import { MAX_STEPS_PER_FRAME, TIMESTEP_MS } from "../game/tuning";

/** Fixed-timestep update with interpolated render (Gaffer's "fix your timestep"). */
export interface LoopCallbacks {
  /** Advance the simulation by exactly one fixed step (dtMs = TIMESTEP_MS). */
  update(dtMs: number): void;
  /**
   * Draw the world. `alpha` in [0,1) is how far we are between the last
   * two sim states, for interpolation.
   */
  render(alpha: number): void;
}

export class GameLoop {
  private accumulator = 0;
  private lastTime = 0;
  private rafId = 0;
  private running = false;

  constructor(private readonly cb: LoopCallbacks) {}

  start(): void {
    if (this.running) return;
    this.running = true;
    this.lastTime = performance.now();
    this.accumulator = 0;
    this.rafId = requestAnimationFrame(this.frame);
  }

  stop(): void {
    this.running = false;
    cancelAnimationFrame(this.rafId);
  }

  private frame = (now: number): void => {
    if (!this.running) return;
    this.rafId = requestAnimationFrame(this.frame);

    let frameTime = now - this.lastTime;
    this.lastTime = now;
    // Guard against huge gaps (tab was backgrounded, breakpoint, etc.).
    if (frameTime > 250) frameTime = 250;
    this.accumulator += frameTime;

    let steps = 0;
    while (this.accumulator >= TIMESTEP_MS && steps < MAX_STEPS_PER_FRAME) {
      this.cb.update(TIMESTEP_MS);
      this.accumulator -= TIMESTEP_MS;
      steps++;
    }
    // If we blew the step budget, drop the backlog rather than spiral.
    if (steps >= MAX_STEPS_PER_FRAME) this.accumulator = 0;

    this.cb.render(this.accumulator / TIMESTEP_MS);
  };
}
