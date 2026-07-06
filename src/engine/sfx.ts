import { AUDIO } from "../game/tuning";
import { AudioEngine } from "./audio";

/**
 * Tiny procedural sound effects synthesized on the fly — no audio assets.
 * Every effect no-ops until the AudioEngine is unlocked by a user gesture.
 * A continuous engine drone runs while the game is active.
 */
export class Sfx {
  private engineGain: GainNode | null = null;

  constructor(private readonly audio: AudioEngine) {}

  private get ctx(): AudioContext | null {
    return this.audio.context;
  }
  private get out(): GainNode | null {
    return this.audio.out;
  }

  /** Percussive boom: filtered noise burst + a low sine thump. */
  private boom(gain: number, dur: number, lp: number, thumpHz: number): void {
    const ctx = this.ctx;
    const out = this.out;
    const buf = this.audio.noiseBuffer;
    if (!ctx || !out || !buf) return;
    const t0 = ctx.currentTime;

    const src = ctx.createBufferSource();
    src.buffer = buf;
    const filt = ctx.createBiquadFilter();
    filt.type = "lowpass";
    filt.frequency.setValueAtTime(lp, t0);
    filt.frequency.exponentialRampToValueAtTime(lp * 0.4, t0 + dur);
    const g = ctx.createGain();
    g.gain.setValueAtTime(gain, t0);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    src.connect(filt).connect(g).connect(out);
    src.start(t0);
    src.stop(t0 + dur);

    const osc = ctx.createOscillator();
    osc.type = "sine";
    osc.frequency.setValueAtTime(thumpHz, t0);
    osc.frequency.exponentialRampToValueAtTime(thumpHz * 0.5, t0 + dur);
    const og = ctx.createGain();
    og.gain.setValueAtTime(gain * 0.9, t0);
    og.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    osc.connect(og).connect(out);
    osc.start(t0);
    osc.stop(t0 + dur);
  }

  /** Short tone helper. */
  private tone(type: OscillatorType, from: number, to: number, dur: number, gain: number, at = 0): void {
    const ctx = this.ctx;
    const out = this.out;
    if (!ctx || !out) return;
    const t0 = ctx.currentTime + at;
    const osc = ctx.createOscillator();
    osc.type = type;
    osc.frequency.setValueAtTime(from, t0);
    osc.frequency.exponentialRampToValueAtTime(Math.max(1, to), t0 + dur);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(gain, t0 + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    osc.connect(g).connect(out);
    osc.start(t0);
    osc.stop(t0 + dur);
  }

  /** Flak burst. */
  flakThump(): void {
    this.boom(AUDIO.flakGain, 0.28, 900, 130);
  }

  /** Bomb release whistle followed by the impact boom. */
  bombDrop(): void {
    this.tone("triangle", 1300, 320, 0.32, AUDIO.whistleGain);
    // Boom lands as the whistle ends.
    const ctx = this.ctx;
    if (!ctx) return;
    this.scheduleBoom(0.3);
  }

  private scheduleBoom(delay: number): void {
    const ctx = this.ctx;
    const out = this.out;
    const buf = this.audio.noiseBuffer;
    if (!ctx || !out || !buf) return;
    const t0 = ctx.currentTime + delay;
    const src = ctx.createBufferSource();
    src.buffer = buf;
    const filt = ctx.createBiquadFilter();
    filt.type = "lowpass";
    filt.frequency.setValueAtTime(1400, t0);
    filt.frequency.exponentialRampToValueAtTime(300, t0 + 0.45);
    const g = ctx.createGain();
    g.gain.setValueAtTime(AUDIO.boomGain, t0);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.45);
    src.connect(filt).connect(g).connect(out);
    src.start(t0);
    src.stop(t0 + 0.45);
  }

  /** Taking damage. */
  hit(): void {
    this.boom(AUDIO.hitGain, 0.3, 1800, 220);
    this.tone("square", 300, 90, 0.22, AUDIO.hitGain * 0.5);
  }

  /** Searchlight lock / fighter incoming — a two-tone alarm. */
  lock(): void {
    this.tone("sawtooth", 660, 660, 0.12, AUDIO.uiGain);
    this.tone("sawtooth", 880, 880, 0.12, AUDIO.uiGain, 0.14);
  }

  /** Tail-gunner shot (quiet, frequent). */
  shot(): void {
    this.tone("square", 1400, 700, 0.05, AUDIO.shotGain);
  }

  /** Upgrade chosen — a little rising triad. */
  upgrade(): void {
    this.tone("triangle", 523, 523, 0.14, AUDIO.uiGain);
    this.tone("triangle", 659, 659, 0.14, AUDIO.uiGain, 0.1);
    this.tone("triangle", 784, 784, 0.2, AUDIO.uiGain, 0.2);
  }

  /** Start the low engine drone (idempotent). */
  startEngine(): void {
    const ctx = this.ctx;
    const out = this.out;
    if (!ctx || !out || this.engineGain) return;
    const g = ctx.createGain();
    g.gain.value = AUDIO.engineGain;
    const lp = ctx.createBiquadFilter();
    lp.type = "lowpass";
    lp.frequency.value = 420;
    g.connect(out);
    lp.connect(g);
    for (const detune of [0, 0.6]) {
      const osc = ctx.createOscillator();
      osc.type = "sawtooth";
      osc.frequency.value = 54 + detune;
      osc.connect(lp);
      osc.start();
    }
    this.engineGain = g;
  }
}
