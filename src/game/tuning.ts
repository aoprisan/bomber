/**
 * ALL gameplay constants live here so the game can be tuned in one place.
 *
 * Sections grow as milestones land:
 *   M1 — world, bomber, input        (this file, now)
 *   M2 — flak, health                (later)
 *   M3 — targets, scoring            (later)
 *   M4 — tracers, searchlights, balloons
 *   M5 — upgrades, segments
 *   M6 — audio, particles, difficulty curve
 *
 * Distances are in "world units" == CSS pixels at the reference height.
 * The renderer scales the world to the actual canvas so tuning stays
 * resolution-independent.
 */

/** Fixed simulation timestep. Update runs at this rate; render interpolates. */
export const TIMESTEP_HZ = 60;
export const TIMESTEP_MS = 1000 / TIMESTEP_HZ;
/** Cap on how many sim steps a single frame may run (spiral-of-death guard). */
export const MAX_STEPS_PER_FRAME = 5;

export const WORLD = {
  /** Reference portrait play-field. Renderer letterboxes/scales to fit. */
  width: 480,
  height: 854,
  /** Aspect ratio (portrait). Used to compute the fitted viewport. */
  get aspect() {
    return this.width / this.height;
  },
  /** Night sky background. */
  bgTop: "#05060d",
  bgBottom: "#0a1024",
} as const;

export const BOMBER = {
  /** Resting vertical position as a fraction of world height (0 = top). */
  anchorY: 0.72,
  /** Half-extent of the collision circle (world units). */
  radius: 16,
  /** Lateral speed cap (world units / second) when following the drag. */
  maxLateralSpeed: 620,
  /** How sharply the plane chases its target x. Higher = snappier. */
  lateralResponse: 14,
  /** Clamp so the plane can't leave the play-field. */
  edgePadding: 26,
} as const;

export const SCROLL = {
  /** Base downward world-scroll speed (world units / second). */
  baseSpeed: 150,
  /** Vertical drag nudges scroll speed by up to this fraction, +/-. */
  nudgeRange: 0.35,
  /** How much a vertical drag delta maps into a nudge (per world unit). */
  nudgePerUnit: 0.012,
  /** Nudge relaxes back to zero at this rate (per second). */
  nudgeDecay: 3,
} as const;

export const INPUT = {
  /**
   * Relative drag (Archero-style): the plane follows the *delta* of the
   * pointer, not its absolute position. This multiplies pointer travel
   * into world travel so a short thumb swipe crosses the field.
   */
  dragGain: 1.6,
} as const;

export const GROUND = {
  /** Fraction of world height occupied by the ground band at the bottom. */
  bandHeight: 0.18,
  color: "#070b16",
  /** Slightly lighter roofs / rubble speckle on the ground band. */
  blockColor: "#0e1630",
  blockLight: "#16204a",
  /** River ribbon winding down the ground for a landmark. */
  riverColor: "#0c1b3a",
  /** Parallax layers drawn behind the play-field (far -> near). */
  parallax: [
    { speed: 0.35, color: "#0b1330", size: 3 },
    { speed: 0.6, color: "#111c40", size: 4 },
  ],
} as const;

// ---------------------------------------------------------------------------
// M2 — health, flak, spawning
// ---------------------------------------------------------------------------

export const HEALTH = {
  /** Starting / max hit points. Upgrades (M5) raise this. */
  maxHp: 3,
  /** Invulnerability window after taking a hit (ms). */
  iframesMs: 1100,
  /** Blink rate of the bomber while invulnerable (blinks / second). */
  blinkHz: 8,
} as const;

/**
 * Flak burst — area denial. Lifecycle is entirely time-driven so the whole
 * "feel" is tunable here:
 *   telegraph : ground muzzle flash + growing reticle at the marked point
 *   expand    : blast circle punches out to blastRadius (starts damaging)
 *   linger    : full-size blast dwells (still damaging)
 *   fade      : blast shrinks/dims, harmless
 */
export const FLAK = {
  /** Delay from muzzle flash to the blast — the core telegraph window (ms). */
  telegraphMs: 1000,
  /** Blast punch-out duration (ms). */
  expandMs: 240,
  /** Full-size damaging dwell (ms). */
  lingerMs: 200,
  /** Harmless fade-out (ms). */
  fadeMs: 340,
  /** Max blast radius (world units). */
  blastRadius: 76,
  /** Damaging fraction of the current visual radius (blast "core"). */
  coreFraction: 0.86,
  /** HP removed per hit. */
  damage: 1,
  /** Reticle ring size shown during telegraph (world units). */
  reticleRadius: 26,
  /** Bursts spawn within this vertical band (fraction of world height). */
  minY: 0.28,
  maxY: 0.8,
  /** Keep burst centers this far off the play-field edges (world units). */
  edgePad: 44,
  /** Palette. */
  flash: "#fff0c4",
  reticle: "#ff5a3c",
  blastInner: "#ffd98a",
  blastOuter: "#ff7a1e",
} as const;

/**
 * Spawn director. A simple time-based difficulty ramp lives here; the full
 * curve arrives in M6, but the shape is already data-driven.
 */
export const SPAWN = {
  /** Grace period before the first flak burst (ms). */
  flakStartDelayMs: 2600,
  /** Base gap between bursts at the start of a run (ms). */
  flakIntervalMs: 2100,
  /** Ramp floor — smallest gap between bursts (ms). */
  flakIntervalMinMs: 850,
  /** Play time over which the interval ramps from base to floor (ms). */
  flakRampMs: 90_000,
  /** Chance a spawn tick fires a second simultaneous burst (ramps to x2). */
  doubleChanceStart: 0.0,
  doubleChanceEnd: 0.55,
  /** Object-pool capacity for live flak bursts. */
  maxFlak: 40,

  /** Grace before the first target scrolls in (ms). */
  targetStartDelayMs: 1200,
  /** Gap between target spawns (ms); jittered per spawn. */
  targetGapMs: 1500,
  targetGapJitterMs: 900,
  /** Object-pool capacity for live targets. */
  maxTargets: 24,
} as const;

// ---------------------------------------------------------------------------
// M3 — targets, bombing, scoring
// ---------------------------------------------------------------------------

/**
 * Bombable ground installations. They scroll down the field at world speed;
 * when one crosses the bombsight and the plane is lined up over it, a bomb is
 * auto-dropped. Widths/scores are per type so lining up over a fat factory is
 * both easier and worth more — but factories sit deeper in flak later.
 */
export const TARGET = {
  types: [
    { key: "depot", label: "DEPOT", w: 46, h: 26, score: 100, body: "#5a4526", roof: "#8a6a3c" },
    { key: "rail", label: "RAIL YARD", w: 66, h: 22, score: 150, body: "#38414f", roof: "#586374" },
    { key: "factory", label: "FACTORY", w: 74, h: 34, score: 250, body: "#4c2f2f", roof: "#744a4a" },
  ],
  /** Keep target centers this far off the play-field edges (world units). */
  edgePad: 46,
  /** Lit-window glint color on structures. */
  windowColor: "#ffd27a",
} as const;

export const BOMB = {
  /** The bombsight leads the plane by this much (world units, up-screen). */
  leadDistance: 150,
  /** Half-height of the drop window around the sight line (world units). */
  dropBandHalf: 12,
  /** Base x tolerance for a hit beyond the target's own half-width. */
  aimTolerance: 6,
  /** Bombsight reticle half-size (world units). */
  reticleHalf: 20,
  reticleColor: "#9fe8ff",
  /** How long the drop streak (bomber -> impact) is drawn (ms). */
  streakMs: 160,
} as const;

export const EXPLOSION = {
  durationMs: 460,
  maxRadius: 46,
  inner: "#fff2c4",
  outer: "#ff7a1e",
  /** Object-pool capacities. */
  maxExplosions: 40,
  maxPopups: 40,
} as const;

export const SCORING = {
  /** Combo multiplier ceiling. */
  comboMax: 8,
  /** Consecutive hits needed to gain each +1 multiplier. */
  hitsPerMultiplier: 3,
  /** Score popup rise distance + lifetime. */
  popupRise: 42,
  popupMs: 900,
  popupColor: "#ffe9b0",
} as const;

