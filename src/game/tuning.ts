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
  /** Parallax layers drawn behind the play-field (far -> near). */
  parallax: [
    { speed: 0.35, color: "#0b1330", size: 3 },
    { speed: 0.6, color: "#111c40", size: 4 },
  ],
} as const;
