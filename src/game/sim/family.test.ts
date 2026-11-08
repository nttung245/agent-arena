import { describe, expect, it } from "vitest";
import { drawBirth } from "@/game/sim/birth";
import { divorceChance, firstPartnerChance, maritalBirthChance, rollFamily } from "@/game/sim/family";
import { rollIllness } from "@/game/sim/illness";
import { rollPersonDeath, rollRelativeDeaths } from "@/game/sim/mortality";
import { checkInvariants, type SimState } from "@/game/sim/person";
import { createRng, type Rng } from "@/game/sim/rng";
import { cohortFertility, everMarried, type Sex } from "@/game/sim/tables";

/** One year of the death, illness and family modules, in engine order. */
function liveYear(state: SimState, rng: Rng): void {
  rollRelativeDeaths(state, rng);
  rollIllness(state, rng);
  if (!state.ended) rollPersonDeath(state, rng);
  if (!state.ended) rollFamily(state, rng);
  if (!state.ended) {
    state.age++;
    state.year++;
  }
}

function life(seed: number, year: number, sex: Sex, untilAge = 200): SimState {
  const rng = createRng(seed);
  const state = drawBirth({ seed, year, sex }, rng);
  while (!state.ended && state.age < untilAge) liveYear(state, rng);
  return state;
}

describe("chances", () => {
  it("never partners anyone under 16", () => {
    for (let age = 0; age < 16; age++) expect(firstPartnerChance("female", 1990, age)).toBe(0);
    expect(firstPartnerChance("female", 1990, 21)).toBeGreaterThan(0.05);
  });

  it("gives no births outside 15–49 and more in 1975 than in 2015", () => {
    expect(maritalBirthChance(1990, 14)).toBe(0);
    expect(maritalBirthChance(1990, 50)).toBe(0);
    expect(maritalBirthChance(1975, 30)).toBeGreaterThan(maritalBirthChance(2015, 30));
  });

  it("raises divorce from 2000", () => {
    expect(divorceChance(2010)).toBeGreaterThan(divorceChance(1990));
  });
});

describe("rollFamily", () => {
  it("never breaks a family rule over 600 full lives", () => {
    for (let i = 0; i < 600; i++) {
      const rng = createRng(i);
      const state = drawBirth({ seed: i, year: 1950 + (i % 76), sex: i % 2 ? "male" : "female" }, rng);
      while (!state.ended) {
        liveYear(state, rng);
        const errors = checkInvariants(state);
        if (errors.length > 0) throw new Error(`seed ${i}, age ${state.age}: ${errors.join("; ")}`);
      }
    }
  });

  it("makes a widow when the partner dies, and allows a new partner later", () => {
    let widowed = 0;
    let remarried = 0;
    for (let i = 0; i < 400; i++) {
      const state = life(10_000 + i, 1950, "female");
      const partners = state.relatives.filter((r) => r.role === "partner");
      if (partners.some((p) => !p.alive && p.diedYear! <= state.year)) widowed++;
      if (partners.length > 1) remarried++;
    }
    expect(widowed).toBeGreaterThan(50);
    expect(remarried).toBeGreaterThan(0);
  });

  it("gives earlier generations more younger siblings", () => {
    const younger = (year: number) => {
      let total = 0;
      for (let i = 0; i < 400; i++) {
        const state = life(20_000 + i, year, "male", 20);
        total += state.relatives.filter((r) => r.role === "sibling" && r.birthYear > year).length;
      }
      return total / 400;
    };
    expect(younger(1955)).toBeGreaterThan(younger(2005));
  });

  it("does nothing once the life has ended", () => {
    const state = life(5, 1990, "female");
    expect(rollFamily(state, createRng(1))).toEqual([]);
  });
});

describe("calibration: family", () => {
  const SLOW = 60_000;

  for (const birthYear of [1960, 1985]) {
    it(`women born in ${birthYear} who reach 50 have the UN's lifetime fertility (±0.25)`, () => {
      let women = 0;
      let children = 0;
      for (let i = 0; i < 3000; i++) {
        const state = life(birthYear * 10_000 + i, birthYear, "female", 50);
        if (state.ended) continue;
        women++;
        children += state.relatives.filter((r) => r.role === "child").length;
      }
      const simulated = children / women;
      const expected = cohortFertility(birthYear);
      console.log(`women born ${birthYear}: children ${simulated.toFixed(2)} vs UN ${expected.toFixed(2)}`);
      expect(Math.abs(simulated - expected)).toBeLessThan(0.25);
    }, SLOW);
  }

  it("matches the UN's ever-married shares at survey ages (±5 points)", () => {
    const check = (sex: Sex, birthYear: number, age: number) => {
      let alive = 0;
      let married = 0;
      for (let i = 0; i < 3000; i++) {
        const state = life(birthYear * 10_000 + 7000 + i, birthYear, sex, age);
        if (state.ended) continue;
        alive++;
        if (state.relatives.some((r) => r.role === "partner")) married++;
      }
      const simulated = married / alive;
      // The share at exact age `age`, as of the year the cohort reaches it.
      const expected = everMarried(sex, birthYear + age, age);
      console.log(`${sex} born ${birthYear} at ${age}: ever partnered ${(simulated * 100).toFixed(1)}% vs UN ${(expected * 100).toFixed(1)}%`);
      expect(Math.abs(simulated - expected)).toBeLessThan(0.05);
    };
    check("female", 1972, 25);
    check("female", 1960, 37);
    check("male", 1975, 27);
  }, SLOW);
});

describe("widowhood", () => {
  it("ends the partnership the moment the partner dies", () => {
    for (let i = 0; i < 3000; i++) {
      const rng = createRng(40_000 + i);
      const state = drawBirth({ seed: i, year: 1955, sex: "female" }, rng);
      while (!state.ended && state.partnerId === null) liveYear(state, rng);
      if (state.ended) continue;
      const partner = state.relatives.find((r) => r.id === state.partnerId)!;
      partner.birthYear = state.year - 99; // very likely to die this year
      const events = rollRelativeDeaths(state, rng);
      if (!partner.alive) {
        expect(state.partnerId).toBeNull();
        expect(events).toContainEqual({ type: "widowed", relativeId: partner.id });
        return;
      }
    }
    throw new Error("no partner died in 3000 tries");
  });
});
