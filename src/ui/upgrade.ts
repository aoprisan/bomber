import { UPGRADES } from "../game/tuning";
import { UpgradeDef, UpgradeKey, UpgradeMods } from "../game/upgrades";

/**
 * Upgrade picker (DOM overlay). Shown between raid segments: presents up to
 * three upgrade cards; clicking one applies it and resumes the raid.
 */
export class UpgradePicker {
  private readonly root: HTMLDivElement;
  private readonly title: HTMLDivElement;
  private readonly cards: HTMLDivElement;

  constructor(
    parent: HTMLElement,
    private readonly onPick: (key: UpgradeKey) => void,
  ) {
    this.root = document.createElement("div");
    this.root.className = "upgrade hidden";

    this.title = document.createElement("div");
    this.title.className = "upgrade-title";

    this.cards = document.createElement("div");
    this.cards.className = "upgrade-cards";

    this.root.append(this.title, this.cards);
    parent.appendChild(this.root);
  }

  show(choices: readonly UpgradeDef[], segment: number, mods: UpgradeMods): void {
    this.title.innerHTML = `SEGMENT ${segment} CLEARED<span>CHOOSE AN UPGRADE</span>`;
    this.cards.textContent = "";
    for (const def of choices) {
      this.cards.appendChild(this.card(def, mods));
    }
    this.root.classList.remove("hidden");
  }

  hide(): void {
    this.root.classList.add("hidden");
  }

  private card(def: UpgradeDef, mods: UpgradeMods): HTMLButtonElement {
    const max = UPGRADES.maxLevel[def.key];
    const level = mods.levels[def.key];

    const btn = document.createElement("button");
    btn.className = "upgrade-card";

    const name = document.createElement("div");
    name.className = "upgrade-name";
    name.textContent = def.name;

    const desc = document.createElement("div");
    desc.className = "upgrade-desc";
    desc.textContent = def.desc;

    const pips = document.createElement("div");
    pips.className = "upgrade-pips";
    for (let i = 0; i < max; i++) {
      const pip = document.createElement("span");
      // Filled = owned; the next pip is the one you're about to gain.
      pip.className =
        i < level ? "upip owned" : i === level ? "upip gain" : "upip";
      pips.appendChild(pip);
    }

    btn.append(name, desc, pips);
    btn.addEventListener("click", () => this.onPick(def.key));
    return btn;
  }
}
