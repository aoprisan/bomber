import { Game } from "../game/game";

/**
 * Heads-up display (DOM overlay, not canvas): HP pips and the run timer.
 * `update` is polled once per rendered frame from the current game state.
 */
export class Hud {
  private readonly root: HTMLDivElement;
  private readonly pips: HTMLDivElement;
  private readonly timer: HTMLDivElement;
  private renderedHp = -1;
  private renderedMax = -1;

  constructor(parent: HTMLElement) {
    this.root = document.createElement("div");
    this.root.className = "hud";

    this.pips = document.createElement("div");
    this.pips.className = "hud-hp";

    this.timer = document.createElement("div");
    this.timer.className = "hud-timer";

    this.root.append(this.pips, this.timer);
    parent.appendChild(this.root);
  }

  update(game: Game): void {
    const { hp, maxHp } = game.bomber;
    if (hp !== this.renderedHp || maxHp !== this.renderedMax) {
      this.renderPips(hp, maxHp);
      this.renderedHp = hp;
      this.renderedMax = maxHp;
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
