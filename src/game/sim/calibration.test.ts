/**
 * Many-life checks: simulated lives, added up, must reproduce the sourced
 * tables. Print the comparison with:
 *   npx vitest run src/game/sim/calibration.test.ts --reporter=verbose --silent=false
 */
import { describe, expect, it } from "vitest";
import { drawBirth } from "@/game/sim/birth";
import { chronicShare, isChronicCourse } from "@/game/sim/causes";
import { illnessCourse, rollIllness } from "@/game/sim/illness";
import { rollPersonDeath } from "@/game/sim/mortality";
import { createRng } from "@/game/sim/rng";
import { deathChance, type Sex } from "@/game/sim/tables";

const LIVES = 4000;
/** Many-life tests run for several seconds, longer under coverage. */
const SLOW = 60_000;

/** Expected completed age at death for a birth cohort, along the table's diagonal. */
function expectedAgeAtDeath(sex: Sex, birthYear: number): number {
  let alive = 1;
  let total = 0;
  for (let age = 0; age < 130 && alive > 1e-9; age++) {
    const deaths = alive * deathChance(sex, birthYear + age, age);
    total += deaths * age;
    alive -= deaths;
  }
  return total;
}

interface CohortResult {
  meanAge: number;
  /** Deaths at 30–69: how many were from long illnesses, and how many the table expects. */
  midlifeDeaths: number;
  midlifeChronic: number;
  midlifeChronicExpected: number;
  /** Years from diagnosis to death, and the course lengths those illnesses expect. */
  illnessYears: number[];
  illnessYearsExpected: number[];
}

/** Lives a cohort with illness and death only. */
function liveCohort(sex: Sex, birthYear: number): CohortResult {
  const result: CohortResult = {
    meanAge: 0,
    midlifeDeaths: 0,
    midlifeChronic: 0,
    midlifeChronicExpected: 0,
    illnessYears: [],
    illnessYearsExpected: [],
  };
  let totalAge = 0;
  for (let i = 0; i < LIVES; i++) {
    const seed = birthYear * 100_000 + (sex === "male" ? 50_000 : 0) + i;
    const rng = createRng(seed);
    const state = drawBirth({ seed, year: birthYear, sex }, rng);
    const diagnosed = new Map<string, number>();
    for (;;) {
      for (const event of rollIllness(state, rng)) {
        if (event.type === "diagnosed") diagnosed.set(event.cause, state.year);
      }
      if (state.ended || rollPersonDeath(state, rng)) break;
      state.age++;
      state.year++;
    }
    const death = state.death!;
    totalAge += death.age;
    if (death.age >= 30 && death.age < 70) {
      result.midlifeDeaths++;
      if (isChronicCourse(death.cause)) result.midlifeChronic++;
      result.midlifeChronicExpected += chronicShare(death.year, death.age, sex);
    }
    if (isChronicCourse(death.cause) && diagnosed.has(death.cause)) {
      result.illnessYears.push(death.year - diagnosed.get(death.cause)!);
      result.illnessYearsExpected.push(illnessCourse(death.cause).years);
    }
  }
  result.meanAge = totalAge / LIVES;
  return result;
}

const mean = (values: number[]) => values.reduce((s, v) => s + v, 0) / values.length;

describe("calibration: deaths", () => {
  const rows: string[] = [];
  for (const birthYear of [1950, 1975, 2000]) {
    for (const sex of ["female", "male"] as const) {
      it(`matches the UN table for ${sex}s born in ${birthYear}`, () => {
        const expected = expectedAgeAtDeath(sex, birthYear);
        const r = liveCohort(sex, birthYear);
        const chronic = r.midlifeChronic / r.midlifeDeaths;
        const chronicExpected = r.midlifeChronicExpected / r.midlifeDeaths;
        rows.push(
          `${birthYear} ${sex.padEnd(6)} age at death: table ${expected.toFixed(1)} simulated ${r.meanAge.toFixed(1)} | ` +
            `long-illness share of deaths 30-69: table ${(chronicExpected * 100).toFixed(1)}% simulated ${(chronic * 100).toFixed(1)}% | ` +
            `diagnosis to death: course ${mean(r.illnessYearsExpected).toFixed(1)}y simulated ${mean(r.illnessYears).toFixed(1)}y`,
        );
        // Mean age at death within a year of the UN table.
        expect(Math.abs(r.meanAge - expected)).toBeLessThan(1);
        // Long illnesses cause about the share of midlife deaths the cause tables say.
        expect(Math.abs(chronic - chronicExpected)).toBeLessThan(0.04);
        // Illness deaths arrive years after the diagnosis, about as long as the courses say.
        expect(Math.abs(mean(r.illnessYears) - mean(r.illnessYearsExpected))).toBeLessThan(1);
      }, SLOW);
    }
  }
  it("prints the comparison", () => {
    console.log(`Deaths, ${LIVES} lives per row:\n${rows.join("\n")}`);
  });
});
