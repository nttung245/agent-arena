/**
 * The game's LifeTransport over the local engine: no key, no network. A life
 * with no seed gets a random one here, at the boundary; inside src/game/sim
 * all randomness comes from the seed.
 */
import type { LifeTransport } from "@/game/engine/types";
import { startLife, stepLife } from "@/game/sim/engine";

function randomSeed(): number {
  const word = new Uint32Array(1);
  globalThis.crypto.getRandomValues(word);
  return word[0] | 0;
}

function attempt<T>(work: () => T): Promise<T> {
  try {
    return Promise.resolve(work());
  } catch (error) {
    return Promise.reject(error);
  }
}

export function createLocalTransport(seed: () => number = randomSeed): LifeTransport {
  return {
    start(options) {
      return attempt(() => startLife({ ...options, seed: options.seed ?? seed() }));
    },
    step(body) {
      return attempt(() => stepLife(body));
    },
  };
}
