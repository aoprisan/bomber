/**
 * Relative-drag pointer input (Archero-style).
 *
 * The plane follows the *movement* of a held pointer, not its absolute
 * position — press anywhere, then drag. We accumulate per-frame deltas and
 * hand them to the game, which decides how to apply them (lateral steer +
 * a vertical speed nudge). Works with touch, pen, and mouse.
 */
export interface DragFrame {
  /** Horizontal pointer travel since last poll, in CSS pixels. */
  dx: number;
  /** Vertical pointer travel since last poll, in CSS pixels. */
  dy: number;
  /** Whether a pointer is currently held down. */
  active: boolean;
}

export class PointerInput {
  private lastX = 0;
  private lastY = 0;
  private accX = 0;
  private accY = 0;
  private down = false;
  private pointerId: number | null = null;

  /** Fires on the first pointerdown ever — used to unlock WebAudio. */
  onFirstGesture: (() => void) | null = null;
  private firstGestureFired = false;

  constructor(private readonly target: HTMLElement) {
    target.addEventListener("pointerdown", this.onDown, { passive: false });
    target.addEventListener("pointermove", this.onMove, { passive: false });
    target.addEventListener("pointerup", this.onUp);
    target.addEventListener("pointercancel", this.onUp);
    // Block the browser's touch gestures (scroll, pull-to-refresh) on the field.
    target.style.touchAction = "none";
  }

  private onDown = (e: PointerEvent): void => {
    e.preventDefault();
    if (this.pointerId !== null) return; // ignore extra fingers
    this.pointerId = e.pointerId;
    this.down = true;
    this.lastX = e.clientX;
    this.lastY = e.clientY;
    this.target.setPointerCapture?.(e.pointerId);
    if (!this.firstGestureFired) {
      this.firstGestureFired = true;
      this.onFirstGesture?.();
    }
  };

  private onMove = (e: PointerEvent): void => {
    if (!this.down || e.pointerId !== this.pointerId) return;
    e.preventDefault();
    this.accX += e.clientX - this.lastX;
    this.accY += e.clientY - this.lastY;
    this.lastX = e.clientX;
    this.lastY = e.clientY;
  };

  private onUp = (e: PointerEvent): void => {
    if (e.pointerId !== this.pointerId) return;
    this.down = false;
    this.pointerId = null;
  };

  /** Consume accumulated movement since the last call. */
  poll(): DragFrame {
    const frame: DragFrame = { dx: this.accX, dy: this.accY, active: this.down };
    this.accX = 0;
    this.accY = 0;
    return frame;
  }
}
