import { Bomber } from "./entities";
import { GROUND, WORLD } from "./tuning";

/**
 * Canvas renderer. Owns device-pixel sizing and a world->screen transform
 * that fits the reference portrait field into whatever viewport we get,
 * letterboxing the remainder. All draw calls work in world units.
 */
export class Renderer {
  private ctx: CanvasRenderingContext2D;
  private scale = 1;
  private offsetX = 0;
  private offsetY = 0;

  constructor(private readonly canvas: HTMLCanvasElement) {
    const ctx = canvas.getContext("2d", { alpha: false });
    if (!ctx) throw new Error("2D canvas context unavailable");
    this.ctx = ctx;
    this.resize();
    window.addEventListener("resize", this.resize);
    window.addEventListener("orientationchange", this.resize);
  }

  resize = (): void => {
    const dpr = Math.min(window.devicePixelRatio || 1, 2.5);
    const w = window.innerWidth;
    const h = window.innerHeight;
    this.canvas.width = Math.round(w * dpr);
    this.canvas.height = Math.round(h * dpr);
    this.canvas.style.width = `${w}px`;
    this.canvas.style.height = `${h}px`;

    // Fit WORLD (contain) inside the viewport, centered.
    this.scale = Math.min(w / WORLD.width, h / WORLD.height);
    this.offsetX = (w - WORLD.width * this.scale) / 2;
    this.offsetY = (h - WORLD.height * this.scale) / 2;
    // Bake DPR into the base transform.
    this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  };

  /** Map a world point to CSS pixels (for input, HUD anchoring, etc.). */
  worldToScreen(wx: number, wy: number): { x: number; y: number } {
    return { x: this.offsetX + wx * this.scale, y: this.offsetY + wy * this.scale };
  }

  private applyWorldTransform(): void {
    const dpr = Math.min(window.devicePixelRatio || 1, 2.5);
    this.ctx.setTransform(
      this.scale * dpr,
      0,
      0,
      this.scale * dpr,
      this.offsetX * dpr,
      this.offsetY * dpr,
    );
  }

  /** Draw a full frame. `scrollY` is total world distance scrolled so far. */
  draw(bomber: Bomber, scrollY: number, alpha: number): void {
    const ctx = this.ctx;

    // Letterbox background (device space).
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.fillStyle = "#000";
    ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);

    this.applyWorldTransform();
    ctx.save();
    // Clip to the world field so parallax/ground don't spill into letterbox.
    ctx.beginPath();
    ctx.rect(0, 0, WORLD.width, WORLD.height);
    ctx.clip();

    this.drawSky();
    this.drawParallax(scrollY);
    this.drawGround(scrollY);
    this.drawBomber(bomber, alpha);

    ctx.restore();
  }

  private drawSky(): void {
    const ctx = this.ctx;
    const g = ctx.createLinearGradient(0, 0, 0, WORLD.height);
    g.addColorStop(0, WORLD.bgTop);
    g.addColorStop(1, WORLD.bgBottom);
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, WORLD.width, WORLD.height);
  }

  /**
   * Parallax dot layers (stars / distant flak sparks). Deterministic hashed
   * positions scrolled by per-layer speed and wrapped over the field height.
   */
  private drawParallax(scrollY: number): void {
    const ctx = this.ctx;
    const cols = 9;
    const rows = 14;
    GROUND.parallax.forEach((layer, li) => {
      ctx.fillStyle = layer.color;
      const spanY = WORLD.height + 40;
      const shift = (scrollY * layer.speed) % spanY;
      for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols; c++) {
          const h = hash2(c, r + li * 97);
          const px = ((c + h) / cols) * WORLD.width;
          let py = ((r + (h * 7) % 1) / rows) * spanY + shift;
          py = ((py % spanY) + spanY) % spanY - 20;
          ctx.fillRect(px, py, layer.size, layer.size);
        }
      }
    });
  }

  private drawGround(scrollY: number): void {
    const ctx = this.ctx;
    const bandH = WORLD.height * GROUND.bandHeight;
    const top = WORLD.height - bandH;
    ctx.fillStyle = GROUND.color;
    ctx.fillRect(0, top, WORLD.width, bandH);

    // Scrolling grid of "city block" ticks along the ground for motion cues.
    ctx.strokeStyle = "rgba(120,150,220,0.10)";
    ctx.lineWidth = 1;
    const spacing = 46;
    const shift = scrollY % spacing;
    ctx.beginPath();
    for (let y = top + shift; y < WORLD.height; y += spacing) {
      ctx.moveTo(0, y);
      ctx.lineTo(WORLD.width, y);
    }
    ctx.stroke();
  }

  private drawBomber(bomber: Bomber, alpha: number): void {
    const ctx = this.ctx;
    const x = bomber.renderX(alpha);
    const y = bomber.y;

    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(bomber.roll * 0.4);

    // Simple twin-engine heavy-bomber silhouette (nose points up-screen).
    ctx.fillStyle = "#c9d4ec";
    ctx.beginPath();
    ctx.moveTo(0, -20); // nose
    ctx.lineTo(6, -6);
    ctx.lineTo(6, 8);
    ctx.lineTo(3, 16); // tail
    ctx.lineTo(-3, 16);
    ctx.lineTo(-6, 8);
    ctx.lineTo(-6, -6);
    ctx.closePath();
    ctx.fill();

    // Wings.
    ctx.fillStyle = "#aab6d6";
    ctx.beginPath();
    ctx.moveTo(-22, 2);
    ctx.lineTo(22, 2);
    ctx.lineTo(14, 8);
    ctx.lineTo(-14, 8);
    ctx.closePath();
    ctx.fill();

    // Tailplane.
    ctx.beginPath();
    ctx.moveTo(-10, 14);
    ctx.lineTo(10, 14);
    ctx.lineTo(6, 18);
    ctx.lineTo(-6, 18);
    ctx.closePath();
    ctx.fill();

    // Cockpit glow.
    ctx.fillStyle = "rgba(120,200,255,0.8)";
    ctx.beginPath();
    ctx.arc(0, -8, 2.4, 0, Math.PI * 2);
    ctx.fill();

    ctx.restore();
  }
}

/** Cheap deterministic hash -> [0,1). */
function hash2(x: number, y: number): number {
  const n = Math.sin(x * 127.1 + y * 311.7) * 43758.5453;
  return n - Math.floor(n);
}
