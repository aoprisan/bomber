import { PointerInput } from "../engine/input";
import { Bomber, clamp } from "./entities";
import { Renderer } from "./render";
import { INPUT, SCROLL } from "./tuning";

/**
 * Top-level game state + simulation. For M1 this is: a bomber steered by
 * relative drag, and a world that scrolls downward past it with a small
 * speed nudge from vertical drag. Threats, targets, HP, etc. layer on in
 * later milestones.
 */
export class Game {
  readonly bomber = new Bomber();
  /** Total world distance scrolled (drives parallax + ground). */
  scrollY = 0;
  /** Current scroll-speed nudge in [-nudgeRange, +nudgeRange]. */
  private nudge = 0;
  /** One-poll-per-frame guard so multi-substep frames don't drop input. */
  private inputConsumedThisFrame = false;

  constructor(
    private readonly input: PointerInput,
    private readonly renderer: Renderer,
  ) {}

  /** Advance one fixed step. dtMs from the loop; we work in seconds. */
  update(dtMs: number): void {
    const dt = dtMs / 1000;

    if (!this.inputConsumedThisFrame) {
      this.inputConsumedThisFrame = true;
      const drag = this.input.poll();
      // Relative-drag steer: nudge the plane's target x by pointer travel.
      this.bomber.targetX += drag.dx * INPUT.dragGain;
      // Vertical drag nudges scroll speed: drag up (dy<0) = push forward.
      this.nudge += -drag.dy * SCROLL.nudgePerUnit;
      this.nudge = clamp(this.nudge, -SCROLL.nudgeRange, SCROLL.nudgeRange);
    }

    // Nudge relaxes back to neutral cruise.
    this.nudge -= this.nudge * clamp(SCROLL.nudgeDecay * dt, 0, 1);

    this.bomber.update(dt);
    this.scrollY += SCROLL.baseSpeed * (1 + this.nudge) * dt;
  }

  render(alpha: number): void {
    this.renderer.draw(this.bomber, this.scrollY, alpha);
    // A render marks the frame boundary: allow the next frame to poll input.
    this.inputConsumedThisFrame = false;
  }
}
