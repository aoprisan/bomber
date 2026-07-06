import { Bomber } from "./entities";
import { UPGRADES } from "./tuning";

export type UpgradeKey = "armor" | "spread" | "flares" | "tailgun" | "engine" | "tanks";

/** Mutable modifier state accumulated by upgrade picks over a run. */
export interface UpgradeMods {
  levels: Record<UpgradeKey, number>;
  /** Extra bombsight x-tolerance (world units). */
  spreadAimBonus: number;
  /** Splash x-radius for hitting neighboring targets (0 = single). */
  spreadSplashX: number;
  /** Decoy flare charges (each negates one fighter attack). */
  flares: number;
  /** Tail-gunner level (0 = none). */
  tailgunLevel: number;
  /** Self-sealing tanks level (HP repaired per segment). */
  regenLevel: number;
}

export function createMods(): UpgradeMods {
  return {
    levels: { armor: 0, spread: 0, flares: 0, tailgun: 0, engine: 0, tanks: 0 },
    spreadAimBonus: 0,
    spreadSplashX: 0,
    flares: 0,
    tailgunLevel: 0,
    regenLevel: 0,
  };
}

/** Reset an existing mods object in place (avoids reallocating on restart). */
export function resetMods(mods: UpgradeMods): void {
  const fresh = createMods();
  mods.levels = fresh.levels;
  mods.spreadAimBonus = 0;
  mods.spreadSplashX = 0;
  mods.flares = 0;
  mods.tailgunLevel = 0;
  mods.regenLevel = 0;
}

export interface UpgradeDef {
  key: UpgradeKey;
  name: string;
  desc: string;
  apply(bomber: Bomber, mods: UpgradeMods): void;
}

/** Registry. Effect magnitudes come from tuning (UPGRADES); copy lives here. */
export const UPGRADE_DEFS: readonly UpgradeDef[] = [
  {
    key: "armor",
    name: "ARMOR PLATING",
    desc: "+1 max HP, and repair 1 now.",
    apply: (bomber) => {
      bomber.maxHp += 1;
      bomber.heal(1);
    },
  },
  {
    key: "spread",
    name: "WIDE BOMB SPREAD",
    desc: "Forgiving bombsight; bombs splash neighboring targets.",
    apply: (_bomber, mods) => {
      mods.spreadAimBonus += UPGRADES.spread.aimBonusPerLevel;
      mods.spreadSplashX += UPGRADES.spread.splashXPerLevel;
    },
  },
  {
    key: "flares",
    name: "DECOY FLARES",
    desc: "Negate the next fighter attack. +1 charge.",
    apply: (_bomber, mods) => {
      mods.flares += UPGRADES.flares.perPick;
    },
  },
  {
    key: "tailgun",
    name: "TAIL GUNNER",
    desc: "Auto-fires at night fighters and shoots them down.",
    apply: (_bomber, mods) => {
      mods.tailgunLevel += 1;
    },
  },
  {
    key: "engine",
    name: "ENGINE BOOST",
    desc: "Sharper, faster lateral maneuvering.",
    apply: (bomber) => {
      bomber.speedMul += UPGRADES.engine.speedMulPerLevel;
      bomber.responseMul += UPGRADES.engine.responseMulPerLevel;
    },
  },
  {
    key: "tanks",
    name: "SELF-SEALING TANKS",
    desc: "Repair 1 HP at the start of each segment.",
    apply: (_bomber, mods) => {
      mods.regenLevel += 1;
    },
  },
];

const DEF_BY_KEY = new Map(UPGRADE_DEFS.map((d) => [d.key, d]));

export function upgradeByKey(key: UpgradeKey): UpgradeDef {
  const d = DEF_BY_KEY.get(key);
  if (!d) throw new Error(`Unknown upgrade: ${key}`);
  return d;
}

export function isMaxed(mods: UpgradeMods, key: UpgradeKey): boolean {
  return mods.levels[key] >= UPGRADES.maxLevel[key];
}

/**
 * Roll up to `UPGRADES.choices` distinct upgrades that aren't maxed out.
 * Uses Math.random (game runtime, deterministic seeding not required).
 */
export function rollChoices(mods: UpgradeMods): UpgradeDef[] {
  const pool = UPGRADE_DEFS.filter((d) => !isMaxed(mods, d.key));
  // Fisher-Yates over a copy, take the first N.
  const arr = pool.slice();
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j]!, arr[i]!];
  }
  return arr.slice(0, UPGRADES.choices);
}
