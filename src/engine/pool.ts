/**
 * Fixed-capacity object pool for hot entities (bullets, flak, particles).
 * Avoids per-frame allocation and GC hitches. Objects are reused in place;
 * `reset` re-initializes one when it's handed out.
 */
export class Pool<T> {
  private readonly items: T[] = [];
  /** Count of currently-live objects; live ones occupy [0, active). */
  private activeCount = 0;

  constructor(
    capacity: number,
    factory: () => T,
    private readonly reset: (item: T) => void,
  ) {
    for (let i = 0; i < capacity; i++) this.items.push(factory());
  }

  get active(): number {
    return this.activeCount;
  }

  /** Grab a fresh object, or null if the pool is exhausted. */
  spawn(): T | null {
    if (this.activeCount >= this.items.length) return null;
    const item = this.items[this.activeCount]!;
    this.activeCount++;
    this.reset(item);
    return item;
  }

  /** Retire the live object at index `i` by swapping it with the last live one. */
  release(i: number): void {
    if (i < 0 || i >= this.activeCount) return;
    const last = this.activeCount - 1;
    if (i !== last) {
      const tmp = this.items[i]!;
      this.items[i] = this.items[last]!;
      this.items[last] = tmp;
    }
    this.activeCount--;
  }

  /** Iterate live objects. Return true from `fn` to release that object. */
  forEach(fn: (item: T, i: number) => boolean | void): void {
    for (let i = 0; i < this.activeCount; ) {
      if (fn(this.items[i]!, i) === true) this.release(i);
      else i++;
    }
  }

  clear(): void {
    this.activeCount = 0;
  }
}
