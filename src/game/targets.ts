import { TARGET, WORLD } from "./tuning";

type TargetType = (typeof TARGET.types)[number];

/**
 * A bombable ground installation. Spawns above the field and scrolls down at
 * world speed (advanced by the game each step). It's "bombed" once a bomb is
 * committed to it, so it can't be double-scored, and drawn as a lit structure.
 */
export class Target {
  x = 0;
  y = 0;
  typeIndex = 0;
  bombed = false;
  /** Deterministic window-light pattern seed for draw variety. */
  private seed = 0;

  get type(): TargetType {
    return TARGET.types[this.typeIndex]!;
  }
  get halfWidth(): number {
    return this.type.w / 2;
  }
  get score(): number {
    return this.type.score;
  }

  spawn(x: number, y: number, typeIndex: number, seed: number): void {
    this.x = x;
    this.y = y;
    this.typeIndex = typeIndex;
    this.bombed = false;
    this.seed = seed;
  }

  /** Advance by this step's scroll distance (world units). */
  advance(dScroll: number): void {
    this.y += dScroll;
  }

  get offscreen(): boolean {
    return this.y - this.type.h > WORLD.height;
  }

  draw(ctx: CanvasRenderingContext2D): void {
    const t = this.type;
    const w = t.w;
    const h = t.h;
    const left = this.x - w / 2;
    const top = this.y - h / 2;

    // Ground footprint shadow.
    ctx.fillStyle = "rgba(0,0,0,0.35)";
    ctx.fillRect(left - 2, top + h - 3, w + 4, 6);

    // Body + roof.
    ctx.fillStyle = t.body;
    ctx.fillRect(left, top, w, h);
    ctx.fillStyle = t.roof;
    ctx.fillRect(left, top, w, Math.max(4, h * 0.32));

    // Lit windows — a hashed grid, dimmer once bombed.
    ctx.fillStyle = this.bombed ? "rgba(120,120,120,0.25)" : TARGET.windowColor;
    const cols = Math.max(3, Math.floor(w / 12));
    const rows = Math.max(2, Math.floor(h / 12));
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        if (hash(c + this.seed, r) < 0.5) continue;
        const wx = left + 4 + (c / cols) * (w - 6);
        const wy = top + 6 + (r / rows) * (h - 8);
        ctx.fillRect(wx, wy, 2.5, 2.5);
      }
    }

    // Outline for readability against the dark field.
    ctx.strokeStyle = "rgba(255,255,255,0.10)";
    ctx.lineWidth = 1;
    ctx.strokeRect(left, top, w, h);
  }
}

function hash(x: number, y: number): number {
  const n = Math.sin(x * 41.3 + y * 289.1) * 21793.13;
  return n - Math.floor(n);
}
