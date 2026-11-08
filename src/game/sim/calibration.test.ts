/**
 * Many-life checks: simulated lives, added up, must reproduce the sourced
 * tables. Print the comparison with:
 *   npx vitest run src/game/sim/calibration.test.ts --reporter=verbose --silent=false
 */
import { describe, expect, it } from "vitest";
import { drawBirth } from "@/game/sim/birth";
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

/** Lives a cohort with mortality only and returns the mean completed age at death. */
function simulatedAgeAtDeath(sex: Sex, birthYear: number): number {
  let total = 0;
  for (let i = 0; i < LIVES; i++) {
    const seed = birthYear * 100_000 + (sex === "male" ? 50_000 : 0) + i;
    const rng = createRng(seed);
    const state = drawBirth({ seed, year: birthYear, sex }, rng);
    while (!rollPersonDeath(state, rng)) {
      state.age++;
      state.year++;
    }
    total += state.death!.age;
  }
  return total / LIVES;
}

describe("calibration: age at death", () => {
  const rows: string[] = [];
  for (const birthYear of [1950, 1975, 2000]) {
    for (const sex of ["female", "male"] as const) {
      it(`matches the UN table for ${sex}s born in ${birthYear} within 1 year`, () => {
        const expected = expectedAgeAtDeath(sex, birthYear);
        const simulated = simulatedAgeAtDeath(sex, birthYear);
        rows.push(`${birthYear} ${sex.padEnd(6)} table ${expected.toFixed(1)}  simulated ${simulated.toFixed(1)}`);
        expect(Math.abs(simulated - expected)).toBeLessThan(1);
      }, SLOW);
    }
  }
  it("prints the comparison", () => {
    console.log(`Mean age at death, ${LIVES} lives each:\n${rows.join("\n")}`);
  });
});
