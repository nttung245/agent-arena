/**
 * Seeded random numbers for the life engine. Every roll in a life goes through
 * one of these, and its state travels in the token, so the same seed and the
 * same choices always replay the same life. Never use Math.random in src/game/sim.
 */

export type RngState = [number, number, number, number];

export interface Rng {
  /** A float in [0, 1). */
  next(): number;
  /** A copy of the internal state, to save in the token. */
  state(): RngState;
}

/** sfc32: small, fast, and good enough statistically for a simulation. */
function sfc32(initial: RngState): Rng {
  let [a, b, c, d] = initial;
  return {
    next() {
      const t = (((a + b) | 0) + d) | 0;
      d = (d + 1) | 0;
      a = b ^ (b >>> 9);
      b = (c + (c << 3)) | 0;
      c = (c << 21) | (c >>> 11);
      c = (c + t) | 0;
      return (t >>> 0) / 4294967296;
    },
    state() {
      return [a, b, c, d];
    },
  };
}

/** Spreads one integer seed over sfc32's four words. */
function splitmix32(seed: number): () => number {
  let s = seed | 0;
  return () => {
    s = (s + 0x9e3779b9) | 0;
    let z = s;
    z = Math.imul(z ^ (z >>> 16), 0x85ebca6b);
    z = Math.imul(z ^ (z >>> 13), 0xc2b2ae35);
    return (z ^ (z >>> 16)) | 0;
  };
}

export function createRng(seed: number): Rng {
  const mix = splitmix32(seed);
  const rng = sfc32([mix(), mix(), mix(), mix()]);
  for (let i = 0; i < 12; i++) rng.next(); // warm up past the seed's structure
  return rng;
}

export function restoreRng(state: RngState): Rng {
  return sfc32([state[0] | 0, state[1] | 0, state[2] | 0, state[3] | 0]);
}

export function isRngState(value: unknown): value is RngState {
  return (
    Array.isArray(value) &&
    value.length === 4 &&
    value.every((word) => Number.isInteger(word))
  );
}
