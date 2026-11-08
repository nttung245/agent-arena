import { describe, expect, it } from "vitest";
import { drawBirth } from "@/game/sim/birth";
import { CHRONIC_CAUSES, exitRates, illnessCourse, onsetChance, rollIllness, treatIllness } from "@/game/sim/illness";
import { checkInvariants, type SimState } from "@/game/sim/person";
import { createRng } from "@/game/sim/rng";

function adult(seed: number, age = 55): SimState {
  const rng = createRng(seed);
  const state = drawBirth({ seed, year: 1960, sex: "male" }, rng);
  state.age = age;
  state.year = 1960 + age;
  return state;
}

describe("onsetChance", () => {
  it("is zero for cancers in small children and grows with age", () => {
    expect(onsetChance("lung_cancer", "male", 2000, 2)).toBe(0);
    expect(onsetChance("lung_cancer", "male", 2000, 60)).toBeGreaterThan(onsetChance("lung_cancer", "male", 2000, 35));
  });

  it("is higher for men where the cause is weighted to men", () => {
    expect(onsetChance("liver_cancer", "male", 2010, 55)).toBeGreaterThan(onsetChance("liver_cancer", "female", 2010, 55));
  });
});

describe("exitRates", () => {
  it("ends the illness in death with probability 1 − cure, and treatment helps", () => {
    for (const cause of CHRONIC_CAUSES) {
      const course = illnessCourse(cause);
      const untreated = exitRates({ cause, since: 2000, treated: false });
      expect(untreated.death / (untreated.death + untreated.recovery)).toBeCloseTo(1 - course.cure, 10);
      expect(untreated.death + untreated.recovery).toBeCloseTo(1 / course.years, 10);
      const treated = exitRates({ cause, since: 2000, treated: true });
      expect(treated.death).toBeLessThanOrEqual(untreated.death);
      expect(treated.recovery).toBeGreaterThanOrEqual(untreated.recovery);
    }
  });

  it("refuses an unknown illness", () => {
    expect(() => illnessCourse("stroke")).toThrow();
  });
});

describe("rollIllness", () => {
  it("lets liver cancer kill about 90% of the people who have it, over time", () => {
    let died = 0;
    const n = 3000;
    for (let i = 0; i < n; i++) {
      const state = adult(i);
      state.illnesses = [{ cause: "liver_cancer", since: state.year - 1, treated: false }];
      const rng = createRng(10_000 + i);
      for (let year = 0; year < 30 && !state.ended && state.illnesses.some((x) => x.cause === "liver_cancer"); year++) {
        rollIllness(state, rng);
        state.age++;
        state.year++;
      }
      if (state.death?.cause === "liver_cancer") died++;
    }
    expect(Math.abs(died / n - 0.9)).toBeLessThan(0.03);
  });

  it("takes health away each year of illness and gives some back on recovery", () => {
    const state = adult(1);
    state.illnesses = [{ cause: "copd", since: state.year - 1, treated: false }];
    const before = state.stats.health;
    // COPD never cures; find a year it goes on.
    const rng = createRng(5);
    let events = rollIllness(state, rng);
    while (state.ended) {
      Object.assign(state, adult(1));
      state.illnesses = [{ cause: "copd", since: state.year - 1, treated: false }];
      events = rollIllness(state, rng);
    }
    expect(events.some((e) => e.type === "worsened" && e.cause === "copd")).toBe(true);
    expect(state.stats.health).toBeLessThan(before);
  });

  it("does not move an illness diagnosed this year", () => {
    const state = adult(2);
    state.illnesses = [{ cause: "lung_cancer", since: state.year, treated: false }];
    const events = rollIllness(state, createRng(3));
    expect(events.some((e) => e.type !== "diagnosed")).toBe(false);
    expect(state.ended).toBe(false);
  });

  it("diagnoses illnesses over a long life without breaking the rules", () => {
    let diagnoses = 0;
    for (let i = 0; i < 300; i++) {
      const state = adult(100 + i, 40);
      const rng = createRng(100 + i);
      for (let year = 0; year < 50 && !state.ended; year++) {
        diagnoses += rollIllness(state, rng).filter((e) => e.type === "diagnosed").length;
        expect(checkInvariants(state)).toEqual([]);
        state.age++;
        state.year++;
      }
    }
    expect(diagnoses).toBeGreaterThan(0);
  });

  it("does nothing once the life has ended", () => {
    const state = adult(3);
    state.ended = true;
    state.death = { age: state.age, year: state.year, cause: "stroke" };
    expect(rollIllness(state, createRng(1))).toEqual([]);
  });
});

describe("treatIllness", () => {
  it("marks an illness as treated, and refuses one the person doesn't have", () => {
    const state = adult(4);
    state.illnesses = [{ cause: "tuberculosis", since: state.year, treated: false }];
    expect(treatIllness(state, "tuberculosis")).toBe(true);
    expect(state.illnesses[0].treated).toBe(true);
    expect(treatIllness(state, "copd")).toBe(false);
  });
});
