import { describe, expect, it } from "vitest";
import {
  chanceFromRate,
  meanOne,
  roll,
  scaleChance,
  softmaxPick,
  weightedPick,
} from "@/game/sim/pick";
import { createRng } from "@/game/sim/rng";

function frequencies<K extends string>(pick: () => K, n: number): Record<string, number> {
  const counts: Record<string, number> = {};
  for (let i = 0; i < n; i++) {
    const key = pick();
    counts[key] = (counts[key] ?? 0) + 1;
  }
  return Object.fromEntries(Object.entries(counts).map(([key, count]) => [key, count / n]));
}

describe("roll", () => {
  it("hits at the requested rate and clamps the edges", () => {
    const rng = createRng(1);
    let hits = 0;
    for (let i = 0; i < 100_000; i++) if (roll(rng, 0.3)) hits++;
    expect(Math.abs(hits / 100_000 - 0.3)).toBeLessThan(0.01);
    expect(roll(rng, 0)).toBe(false);
    expect(roll(rng, -1)).toBe(false);
    expect(roll(rng, Number.NaN)).toBe(false);
    expect(roll(rng, 1)).toBe(true);
  });
});

describe("chanceFromRate and scaleChance", () => {
  it("turns a rate into a yearly chance", () => {
    expect(chanceFromRate(0)).toBe(0);
    expect(chanceFromRate(Math.log(2))).toBeCloseTo(0.5, 10);
  });

  it("scales the rate, so chances never pass 1", () => {
    expect(scaleChance(0.6, 2)).toBeCloseTo(0.84, 10);
    expect(scaleChance(0.6, 1)).toBeCloseTo(0.6, 10);
    expect(scaleChance(0.001, 2)).toBeCloseTo(0.002, 5);
    expect(scaleChance(0.5, 0)).toBe(0);
    expect(scaleChance(0, 3)).toBe(0);
    expect(scaleChance(1, 0.5)).toBe(1);
  });
});

describe("weightedPick", () => {
  it("picks in proportion to the weights", () => {
    const rng = createRng(2);
    const freq = frequencies(
      () =>
        weightedPick(rng, [
          { key: "farming", weight: 80 },
          { key: "factory", weight: 8 },
          { key: "trade", weight: 12 },
          { key: "never", weight: 0 },
        ]),
      100_000,
    );
    expect(Math.abs(freq.farming - 0.8)).toBeLessThan(0.01);
    expect(Math.abs(freq.factory - 0.08)).toBeLessThan(0.01);
    expect(Math.abs(freq.trade - 0.12)).toBeLessThan(0.01);
    expect(freq.never).toBeUndefined();
  });

  it("refuses when nothing can be picked", () => {
    expect(() => weightedPick(createRng(3), [{ key: "a", weight: 0 }])).toThrow();
  });
});

describe("softmaxPick", () => {
  it("matches the multinomial-logit probabilities", () => {
    const rng = createRng(4);
    const options = [
      { key: "a", logWeight: Math.log(0.5) },
      { key: "b", logWeight: Math.log(0.3) },
      { key: "c", logWeight: Math.log(0.2) },
      { key: "impossible", logWeight: Number.NEGATIVE_INFINITY },
    ];
    const freq = frequencies(() => softmaxPick(rng, options), 100_000);
    expect(Math.abs(freq.a - 0.5)).toBeLessThan(0.01);
    expect(Math.abs(freq.b - 0.3)).toBeLessThan(0.01);
    expect(Math.abs(freq.c - 0.2)).toBeLessThan(0.01);
    expect(freq.impossible).toBeUndefined();
  });

  it("is stable for very large utilities", () => {
    const rng = createRng(5);
    expect(softmaxPick(rng, [{ key: "x", logWeight: 1000 }, { key: "y", logWeight: -1000 }])).toBe("x");
    expect(() => softmaxPick(rng, [{ key: "x", logWeight: Number.NaN }])).toThrow();
  });
});

describe("meanOne", () => {
  it("keeps the weighted average at 1", () => {
    const shares = { q1: 0.2, q2: 0.2, q3: 0.2, q4: 0.2, q5: 0.2 };
    const scaled = meanOne({ q1: 1.6, q2: 1.3, q3: 1, q4: 0.8, q5: 0.6 }, shares);
    const mean = Object.entries(scaled).reduce(
      (sum, [key, value]) => sum + value * shares[key as keyof typeof shares],
      0,
    );
    expect(mean).toBeCloseTo(1, 10);
    expect(scaled.q1 / scaled.q5).toBeCloseTo(1.6 / 0.6, 10);
  });

  it("weights by uneven shares (town vs village)", () => {
    const scaled = meanOne({ town: 0.8, village: 1.2 }, { town: 0.3, village: 0.7 });
    expect(scaled.town * 0.3 + scaled.village * 0.7).toBeCloseTo(1, 10);
  });

  it("rejects empty or non-positive input", () => {
    expect(() => meanOne({ a: 1 }, { a: 0 })).toThrow();
  });
});
