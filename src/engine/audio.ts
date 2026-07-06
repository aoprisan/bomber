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
}
