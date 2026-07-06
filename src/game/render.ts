import { Explosion, ScorePopup } from "./effects";
import { Bomber } from "./entities";
import { Target } from "./targets";
import { Flak } from "./threats/flak";
import { BOMB, GROUND, WORLD } from "./tuning";

/**
 * Everything the renderer needs to draw one frame. Entity lists are pool
 * backing buffers; only indices [0, count) are live.
 */
export interface Scene {
  bomber: Bomber;
  flak: readonly Flak[];
  flakCount: number;
  targets: readonly Target[];
  targetCount: number;
  explosions: readonly Explosion[];
  explosionCount: number;
  popups: readonly ScorePopup[];
  popupCount: number;
  scrollY: number;
  showReticle: boolean;
}

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

  /** Draw a full frame. */
  draw(scene: Scene, alpha: number): void {
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
    this.drawParallax(scene.scrollY);
    this.drawGround(scene.scrollY);
    for (let i = 0; i < scene.targetCount; i++) scene.targets[i]!.draw(ctx);
    if (scene.showReticle) this.drawReticle(scene.bomber, alpha);
    for (let i = 0; i < scene.flakCount; i++) scene.flak[i]!.draw(ctx);
    if (scene.bomber.visible) this.drawBomber(scene.bomber, alpha);
    for (let i = 0; i < scene.explosionCount; i++) scene.explosions[i]!.draw(ctx);
    for (let i = 0; i < scene.popupCount; i++) scene.popups[i]!.draw(ctx);

    ctx.restore();
  }

  /** Bombsight: a bracket ahead of the plane marking the predicted impact. */
  private drawReticle(bomber: Bomber, alpha: number): void {
    const ctx = this.ctx;
    const x = bomber.renderX(alpha);
    const y = bomber.y - BOMB.leadDistance;
    const h = BOMB.reticleHalf;

    // Faint guide line from the plane up to the sight.
    ctx.strokeStyle = "rgba(159,232,255,0.14)";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(x, bomber.y - bomber.radius);
    ctx.lineTo(x, y + h);
    ctx.stroke();

    // Corner brackets.
    ctx.strokeStyle = BOMB.reticleColor;
    ctx.lineWidth = 2;
    const c = 7;
    ctx.beginPath();
    for (const [sx, sy] of [
      [-1, -1],
      [1, -1],
      [-1, 1],
      [1, 1],
    ] as const) {
      const cx = x + sx * h;
      const cy = y + sy * h;
      ctx.moveTo(cx, cy);
      ctx.lineTo(cx - sx * c, cy);
      ctx.moveTo(cx, cy);
      ctx.lineTo(cx, cy - sy * c);
    }
    ctx.stroke();

    // Center dot.
    ctx.fillStyle = BOMB.reticleColor;
    ctx.beginPath();
    ctx.arc(x, y, 1.6, 0, Math.PI * 2);
    ctx.fill();
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

    // A river ribbon winding down the band as a scrolling landmark.
    ctx.fillStyle = GROUND.riverColor;
    ctx.beginPath();
    const rw = 26;
    for (let y = top; y <= WORLD.height; y += 8) {
      const cx = WORLD.width * 0.5 + Math.sin((y + scrollY) * 0.02) * WORLD.width * 0.22;
      if (y === top) ctx.moveTo(cx - rw / 2, y);
      else ctx.lineTo(cx - rw / 2, y);
    }
    for (let y = WORLD.height; y >= top; y -= 8) {
      const cx = WORLD.width * 0.5 + Math.sin((y + scrollY) * 0.02) * WORLD.width * 0.22;
      ctx.lineTo(cx + rw / 2, y);
    }
    ctx.closePath();
    ctx.fill();

    // Scrolling "city blocks": a hashed grid of little rooftops for motion cues.
    const cell = 34;
    const shift = scrollY % cell;
    for (let gy = -1; gy < bandH / cell + 1; gy++) {
      const wy = top + gy * cell + shift;
      for (let gx = 0; gx < WORLD.width / cell; gx++) {
        const h = hash2(gx, gy + Math.floor(scrollY / cell));
        if (h < 0.4) continue;
        const wx = gx * cell + 4;
        const s = cell - 8;
        ctx.fillStyle = h > 0.8 ? GROUND.blockLight : GROUND.blockColor;
        ctx.fillRect(wx, wy + 3, s * (0.5 + h * 0.4), s * 0.5);
      }
    }

    // Faint horizon line where sky meets ground.
    ctx.strokeStyle = "rgba(120,150,220,0.14)";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(0, top);
    ctx.lineTo(WORLD.width, top);
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
