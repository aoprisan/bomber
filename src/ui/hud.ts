import { Game } from "../game/game";

/**
 * Heads-up display (DOM overlay, not canvas): HP pips and the run timer.
 * `update` is polled once per rendered frame from the current game state.
 */
export class Hud {
  private readonly root: HTMLDivElement;
  private readonly pips: HTMLDivElement;
  private readonly score: HTMLDivElement;
  private readonly combo: HTMLDivElement;
  private readonly timer: HTMLDivElement;
  private renderedHp = -1;
  private renderedMax = -1;
  private renderedScore = -1;
  private renderedMult = -1;

  constructor(parent: HTMLElement) {
    this.root = document.createElement("div");
    this.root.className = "hud";

    this.pips = document.createElement("div");
    this.pips.className = "hud-hp";

    const center = document.createElement("div");
    center.className = "hud-center";
    this.score = document.createElement("div");
    this.score.className = "hud-score";
    this.combo = document.createElement("div");
    this.combo.className = "hud-combo";
    center.append(this.score, this.combo);

    this.timer = document.createElement("div");
    this.timer.className = "hud-timer";

    this.root.append(this.pips, center, this.timer);
    parent.appendChild(this.root);
  }

  update(game: Game): void {
    const { hp, maxHp } = game.bomber;
    if (hp !== this.renderedHp || maxHp !== this.renderedMax) {
      this.renderPips(hp, maxHp);
      this.renderedHp = hp;
      this.renderedMax = maxHp;
    }

    if (game.score !== this.renderedScore) {
      this.score.textContent = game.score.toLocaleString("en-US");
      this.renderedScore = game.score;
    }

    const mult = game.multiplier;
    if (mult !== this.renderedMult) {
      if (mult > 1) {
        this.combo.textContent = `COMBO x${mult}`;
        this.combo.classList.add("active");
      } else {
        this.combo.textContent = "";
        this.combo.classList.remove("active");
      }
      this.renderedMult = mult;
    }

    this.timer.textContent = formatTime(game.elapsedMs);
  }

  private renderPips(hp: number, maxHp: number): void {
    this.pips.textContent = "";
    for (let i = 0; i < maxHp; i++) {
      const pip = document.createElement("span");
      pip.className = i < hp ? "pip pip-full" : "pip pip-empty";
      this.pips.appendChild(pip);
    }
  }
}

function formatTime(ms: number): string {
  const total = Math.floor(ms / 1000);
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
}
