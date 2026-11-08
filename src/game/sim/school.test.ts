import { describe, expect, it } from "vitest";
import { drawBirth } from "@/game/sim/birth";
import { checkInvariants, SCHOOL_STAGES, type SchoolStage, type SimState } from "@/game/sim/person";
import { createRng } from "@/game/sim/rng";
import { completionRate, finishChance, leaveSchool, nationalCompletion, rollSchool, universityEntryChance } from "@/game/sim/school";
import type { Sex } from "@/game/sim/tables";
import { liveYear, nextYear } from "@/game/sim/year";

const SLOW = 60_000;

function liveTo(seed: number, year: number, age: number, options: { sex?: Sex; fifth?: number } = {}): SimState {
  const rng = createRng(seed);
  const state = drawBirth({ seed, year, ...options }, rng);
  while (!state.ended && state.age < age) {
    liveYear(state, rng);
    nextYear(state);
  }
  return state;
}

const atLeast = (stage: SchoolStage, target: SchoolStage) => SCHOOL_STAGES.indexOf(stage) >= SCHOOL_STAGES.indexOf(target);

describe("completion rates", () => {
  it("are lower for the poorest fifth than the richest, and rise over time", () => {
    expect(completionRate("upperSecondary", 2010, 1, "female")).toBeLessThan(completionRate("upperSecondary", 2010, 5, "female"));
    expect(nationalCompletion("upperSecondary", 2015)).toBeGreaterThan(nationalCompletion("upperSecondary", 1996));
    expect(completionRate("primary", 2015, 5, "male")).toBeLessThanOrEqual(0.995);
  });

  it("give a university entry chance between 0 and 1 that grows", () => {
    expect(universityEntryChance(2018)).toBeGreaterThan(universityEntryChance(1985));
    expect(universityEntryChance(2018)).toBeLessThanOrEqual(0.995);
  });
});

describe("rollSchool", () => {
  it("starts school at 6 and finishes stages only at their ages, in order", () => {
    for (let i = 0; i < 300; i++) {
      const rng = createRng(i);
      const state = drawBirth({ seed: i, year: 1990 + (i % 30) }, rng);
      while (!state.ended && state.age < 30) {
        liveYear(state, rng);
        const errors = checkInvariants(state);
        if (errors.length) throw new Error(`seed ${i} age ${state.age}: ${errors.join("; ")}`);
        nextYear(state);
      }
    }
  });

  it("lets a student leave and keeps what they finished", () => {
    const state = liveTo(3, 2000, 12);
    if (state.ended || state.education.studying === null) return;
    expect(leaveSchool(state)).toEqual({ type: "schoolLeft", stage: state.education.completed });
    expect(state.education.studying).toBeNull();
    expect(finishChance(state)).toBe(0);
  });

  it("does nothing after death", () => {
    const state = liveTo(4, 2000, 6);
    state.ended = true;
    state.death = { age: state.age, year: state.year, cause: "stroke" };
    expect(rollSchool(state, createRng(1))).toEqual([]);
  });
});

describe("calibration: school", () => {
  it("matches UNESCO's national completion for lower and upper secondary (±5 points)", () => {
    const share = (birthYear: number, age: number, stage: SchoolStage) => {
      let alive = 0;
      let done = 0;
      for (let i = 0; i < 3000; i++) {
        const state = liveTo(birthYear * 10_000 + i, birthYear, age);
        if (state.ended) continue;
        alive++;
        if (atLeast(state.education.completed, stage)) done++;
      }
      return done / alive;
    };
    const lower = share(1999, 16, "lowerSecondary");
    const upper = share(1995, 19, "upperSecondary");
    console.log(`lower secondary (born 1999): ${(lower * 100).toFixed(1)}% vs UIS ${(nationalCompletion("lowerSecondary", 2014) * 100).toFixed(1)}%`);
    console.log(`upper secondary (born 1995): ${(upper * 100).toFixed(1)}% vs UIS ${(nationalCompletion("upperSecondary", 2013) * 100).toFixed(1)}%`);
    expect(Math.abs(lower - nationalCompletion("lowerSecondary", 2014))).toBeLessThan(0.05);
    expect(Math.abs(upper - nationalCompletion("upperSecondary", 2013))).toBeLessThan(0.05);
  }, SLOW);

  it("keeps the income gradient: the poorest fifth finishes upper secondary far less often", () => {
    const share = (fifth: number) => {
      let alive = 0;
      let done = 0;
      for (let i = 0; i < 1500; i++) {
        const state = liveTo(77_000 + fifth * 10_000 + i, 1995, 19, { fifth });
        if (state.ended) continue;
        alive++;
        if (atLeast(state.education.completed, "upperSecondary")) done++;
      }
      return done / alive;
    };
    expect(share(5) - share(1)).toBeGreaterThan(0.3);
  }, SLOW);
});
