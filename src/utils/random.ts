export class SeededRandom {
  private state: number;

  constructor(seed: number | string) {
    if (typeof seed === "string") {
      let hash = 0;
      for (let i = 0; i < seed.length; i += 1) {
        hash = (hash << 5) - hash + seed.charCodeAt(i);
        hash |= 0;
      }
      this.state = hash >>> 0;
    } else {
      this.state = seed >>> 0;
    }
    if (!this.state) {
      this.state = 0x9e3779b9;
    }
  }

  next(): number {
    // Xorshift32
    let x = this.state;
    x ^= x << 13;
    x ^= x >>> 17;
    x ^= x << 5;
    this.state = x >>> 0;
    return this.state / 0xffffffff;
  }

  intBetween(min: number, max: number): number {
    return Math.floor(this.next() * (max - min + 1)) + min;
  }

  pick<T>(values: T[]): T {
    return values[Math.floor(this.next() * values.length)];
  }
}
