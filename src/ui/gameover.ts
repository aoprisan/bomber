import { RunStats } from "../game/game";

/**
 * Game-over screen (DOM overlay). Shows the run summary and a restart button.
 * Hidden during play; `show` reveals it with the final stats.
 */
export class GameOverScreen {
  private readonly root: HTMLDivElement;
  private readonly stats: HTMLDivElement;

  constructor(parent: HTMLElement, onRestart: () => void) {
    this.root = document.createElement("div");
    this.root.className = "gameover hidden";

    const title = document.createElement("h1");
    title.className = "gameover-title";
    title.textContent = "SHOT DOWN";

    this.stats = document.createElement("div");
    this.stats.className = "gameover-stats";

    const btn = document.createElement("button");
    btn.className = "btn";
    btn.textContent = "FLY AGAIN";
    btn.addEventListener("click", onRestart);

    this.root.append(title, this.stats, btn);
    parent.appendChild(this.root);
  }

  show(stats: RunStats): void {
    const secs = (stats.timeMs / 1000).toFixed(1);
    this.stats.innerHTML = "";
    this.stats.append(
      statRow("SURVIVED", `${secs}s`),
      statRow("HITS TAKEN", String(stats.hitsTaken)),
    );
    this.root.classList.remove("hidden");
  }

  hide(): void {
    this.root.classList.add("hidden");
  }
}

function statRow(label: string, value: string): HTMLDivElement {
  const row = document.createElement("div");
  row.className = "stat-row";
  const l = document.createElement("span");
  l.className = "stat-label";
  l.textContent = label;
  const v = document.createElement("span");
  v.className = "stat-value";
  v.textContent = value;
  row.append(l, v);
  return row;
}
