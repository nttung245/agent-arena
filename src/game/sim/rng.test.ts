import { describe, expect, it } from "vitest";
import { createRng, isRngState, restoreRng } from "@/game/sim/rng";

const draw = (next: () => number, n: number) => Array.from({ length: n }, next);

describe("createRng", () => {
  it("replays the same sequence for the same seed", () => {
    const a = createRng(1972);
    const b = createRng(1972);
    expect(draw(() => a.next(), 50)).toEqual(draw(() => b.next(), 50));
  });

  it("gives different sequences for different seeds", () => {
    const a = createRng(1);
    const b = createRng(2);
    expect(draw(() => a.next(), 10)).not.toEqual(draw(() => b.next(), 10));
  });

  it("stays in [0, 1) and is roughly uniform", () => {
    const rng = createRng(42);
    const buckets = new Array(10).fill(0);
    const n = 100_000;
    for (let i = 0; i < n; i++) {
      const x = rng.next();
      expect(x >= 0 && x < 1).toBe(true);
      buckets[Math.floor(x * 10)]++;
    }
    for (const count of buckets) expect(Math.abs(count / n - 0.1)).toBeLessThan(0.005);
  });
});

describe("restoreRng", () => {
  it("continues exactly where a saved state left off", () => {
    const rng = createRng(7);
    draw(() => rng.next(), 33);
    const saved = rng.state();
    const expected = draw(() => rng.next(), 20);
    const resumed = restoreRng(saved);
    expect(draw(() => resumed.next(), 20)).toEqual(expected);
  });

  it("round-trips through JSON", () => {
    const rng = createRng(99);
    rng.next();
    const state = JSON.parse(JSON.stringify(rng.state()));
    expect(isRngState(state)).toBe(true);
    expect(restoreRng(state).next()).toBe(restoreRng(rng.state()).next());
  });
});

describe("isRngState", () => {
  it("rejects anything that is not four integers", () => {
    expect(isRngState([1, 2, 3])).toBe(false);
    expect(isRngState([1, 2, 3, 4.5])).toBe(false);
    expect(isRngState("1,2,3,4")).toBe(false);
    expect(isRngState([1, 2, 3, 4])).toBe(true);
  });
});
