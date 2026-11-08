import { describe, expect, it } from "vitest";
import {
  DATA_YEARS,
  birthChance,
  boyShare,
  cohortFertility,
  cohortLifeExpectancy,
  deathChance,
  totalDeaths,
  totalFertilityRate,
} from "@/game/sim/tables";

describe("deathChance", () => {
  it("uses the nearest year outside the table's range", () => {
    expect(deathChance("male", 1900, 30)).toBe(deathChance("male", DATA_YEARS.firstYear, 30));
    expect(deathChance("female", 2300, 70)).toBe(deathChance("female", DATA_YEARS.lastYear, 70));
  });

  it("follows the age curve: risky first year, safest around 10, rising after", () => {
    const year = 2023;
    const infant = deathChance("female", year, 0);
    const child = deathChance("female", year, 10);
    const adult = deathChance("female", year, 50);
    const old = deathChance("female", year, 85);
    expect(infant).toBeGreaterThan(child);
    expect(adult).toBeGreaterThan(child);
    expect(old).toBeGreaterThan(adult);
  });

  it("treats 100+ as an open group with a yearly chance below 1", () => {
    const p = deathChance("male", 2000, 104);
    expect(p).toBe(deathChance("male", 2000, 100));
    expect(p > 0.2 && p < 1).toBe(true);
  });

  it("is higher for men than for women of working age", () => {
    expect(deathChance("male", 2010, 45)).toBeGreaterThan(deathChance("female", 2010, 45));
  });
});

describe("birthChance", () => {
  it("is zero outside ages 15–49 and positive inside", () => {
    expect(birthChance(1990, 14)).toBe(0);
    expect(birthChance(1990, 50)).toBe(0);
    expect(birthChance(1990, 25)).toBeGreaterThan(0);
  });

  it("sums to the UN's total fertility rate for a year", () => {
    let total = 0;
    for (let age = 15; age <= 49; age++) total += birthChance(1975, age);
    expect(Math.abs(total - totalFertilityRate(1975))).toBeLessThan(0.02);
  });
});

describe("boyShare and totals", () => {
  it("gives a share of boys a little above one half", () => {
    const share = boyShare(2015);
    expect(share > 0.5 && share < 0.55).toBe(true);
  });

  it("reports deaths in thousands", () => {
    expect(totalDeaths(1990)).toBeGreaterThan(100);
  });
});

describe("cohort measures", () => {
  it("gives later cohorts longer lives", () => {
    expect(cohortLifeExpectancy("female", 2000)).toBeGreaterThan(cohortLifeExpectancy("female", 1950));
    expect(cohortLifeExpectancy("female", 1975)).toBeGreaterThan(cohortLifeExpectancy("male", 1975));
  });

  it("gives earlier cohorts more children", () => {
    expect(cohortFertility(1940 + 15)).toBeGreaterThan(cohortFertility(1990));
  });
});
