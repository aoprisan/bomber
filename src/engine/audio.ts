/**
 * Tiny procedural WebAudio engine. All sounds are synthesized — no asset
 * files. The AudioContext must be created/resumed inside a user gesture
 * (browser autoplay policy), so `unlock()` is wired to the first pointerdown.
 *
 * M1 only establishes the plumbing; individual sound effects (flak thump,
 * bomb whistle/boom, engine drone) arrive in M6.
 */
export class AudioEngine {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private unlocked = false;
  private noise: AudioBuffer | null = null;

  /** Call from a user gesture. Safe to call repeatedly. */
  unlock(): void {
    if (this.unlocked) return;
    const Ctor =
      window.AudioContext ??
      (window as unknown as { webkitAudioContext?: typeof AudioContext })
        .webkitAudioContext;
    if (!Ctor) return;
    this.ctx = new Ctor();
    this.master = this.ctx.createGain();
    this.master.gain.value = 0.6;
    this.master.connect(this.ctx.destination);
    void this.ctx.resume();
    this.unlocked = true;
  }

  get isReady(): boolean {
    return this.unlocked && this.ctx !== null;
  }

  get context(): AudioContext | null {
    return this.ctx;
  }

  get out(): GainNode | null {
    return this.master;
  }

  /** Lazily-built 1s white-noise buffer, shared by percussive effects. */
  get noiseBuffer(): AudioBuffer | null {
    if (!this.ctx) return null;
    if (!this.noise) {
      const len = this.ctx.sampleRate;
      this.noise = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
      const data = this.noise.getChannelData(0);
      // Deterministic PRNG (no Math.random dependency) for reproducibility.
      let s = 1234567;
      for (let i = 0; i < len; i++) {
        s = (s * 1103515245 + 12345) & 0x7fffffff;
        data[i] = (s / 0x3fffffff - 1) * 0.9;
      }
    }
    return this.noise;
  }
}
