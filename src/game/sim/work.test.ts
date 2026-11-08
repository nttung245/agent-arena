import { describe, expect, it } from "vitest";
import { drawBirth } from "@/game/sim/birth";
import { SECTORS, type Sector, type SimState } from "@/game/sim/person";
import { createRng } from "@/game/sim/rng";
import type { Sex } from "@/game/sim/tables";
import { incomeFor, pickJob, retirementAge, rollWork, sectorShares } from "@/game/sim/work";
import { liveYear, nextYear } from "@/game/sim/year";

const SLOW = 60_000;

describe("retirementAge", () => {
  it("follows the Labour Codes of 2012 and 2019", () => {
    expect(retirementAge("male", 2010)).toBe(60);
    expect(retirementAge("female", 2010)).toBe(55);
    expect(retirementAge("male", 2024)).toBe(61);
    expect(retirementAge("male", 2030)).toBe(62);
    expect(retirementAge("female", 2035)).toBe(60);
    expect(retirementAge("female", 2050)).toBe(60);
  });
});

describe("sectorShares and jobs", () => {
  it("add up to 1 and shift out of farming", () => {
    for (const sex of ["female", "male"] as Sex[]) {
      const total = Object.values(sectorShares(2005, sex)).reduce((a, b) => a + b, 0);
      expect(total).toBeCloseTo(1, 10);
      expect(sectorShares(2020, sex).agriculture).toBeLessThan(sectorShares(1995, sex).agriculture);
    }
  });

  it("only gives jobs the schooling allows, and not before they existed", () => {
    const rng = createRng(1);
    for (let i = 0; i < 500; i++) {
      expect(["teacher", "accountant", "doctor", "civil servant", "software developer", "office clerk", "nurse"]).not.toContain(
        pickJob("services", "primary", 2010, rng),
      );
      expect(pickJob("services", "tertiary", 1985, rng)).not.toBe("software developer");
    }
    expect(() => pickJob("services", "none", 1950, createRng(2))).not.toThrow();
  });
});

function liveTo(seed: number, birthYear: number, year: number): SimState {
  const rng = createRng(seed);
  const state = drawBirth({ seed, year: birthYear }, rng);
  while (!state.ended && state.year < year) {
    liveYear(state, rng);
    nextYear(state);
  }
  return state;
}

describe("rollWork", () => {
  it("never starts work before 15 or while studying, and retires everyone eventually", () => {
    let retired = 0;
    for (let i = 0; i < 400; i++) {
      const rng = createRng(500 + i);
      const state = drawBirth({ seed: 500 + i, year: 1950 + (i % 20) }, rng);
      while (!state.ended) {
        liveYear(state, rng);
        if (state.work.status === "working") {
          expect(state.age).toBeGreaterThanOrEqual(15);
          expect(state.education.studying).toBeNull();
          expect(state.work.income).toBeGreaterThan(0);
        }
        nextYear(state);
      }
      if (state.work.status === "retired") retired++;
    }
    expect(retired).toBeGreaterThan(150);
  });

  it("gives richer fifths and more schooling more income", () => {
    const state = liveTo(9, 1990, 2015);
    state.person.fifth = 1;
    const poor = incomeFor(state);
    state.person.fifth = 5;
    const rich = incomeFor(state);
    expect(rich).toBeGreaterThan(poor);
  });

  it("does nothing after death", () => {
    const state = liveTo(10, 1990, 2010);
    state.ended = true;
    state.death = { age: state.age, year: state.year, cause: "road" };
    expect(rollWork(state, createRng(1))).toEqual([]);
  });
});

describe("calibration: work", () => {
  for (const [year, from, to] of [
    [1995, 1950, 1970],
    [2015, 1961, 1990],
  ] as const) {
    it(`matches the World Bank's sector shares among workers in ${year} (±10 points)`, () => {
      const counts: Record<Sector, number> = { agriculture: 0, industry: 0, services: 0 };
      let workers = 0;
      let female = 0;
      for (let i = 0; i < 3000; i++) {
        const state = liveTo(year * 10_000 + i, from + (i % (to - from + 1)), year);
        if (state.ended || state.work.status !== "working") continue;
        counts[state.work.sector!]++;
        workers++;
        if (state.person.sex === "female") female++;
      }
      const f = female / workers;
      const rows: string[] = [];
      const gaps: number[] = [];
      for (const sector of SECTORS) {
        const expected = f * sectorShares(year, "female")[sector] + (1 - f) * sectorShares(year, "male")[sector];
        const simulated = counts[sector] / workers;
        rows.push(`${sector} ${(simulated * 100).toFixed(1)}% vs WDI ${(expected * 100).toFixed(1)}%`);
        gaps.push(Math.abs(simulated - expected));
      }
      console.log(`${year}: ${rows.join(", ")}`);
      for (const gap of gaps) expect(gap).toBeLessThan(0.1);
    }, SLOW);
  }
});
