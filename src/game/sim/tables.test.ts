import { describe, expect, it } from "vitest";
import {
  DATA_YEARS,
  birthChance,
  boyShare,
  cohortFertility,
  cohortLifeExpectancy,
  crisisShares,
  interpolate,
  urbanShare,
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

describe("crisisShares", () => {
  it("attributes a large share of 1968 and 1972 deaths to the war, and almost none after 1975", () => {
    expect(crisisShares(1968).conflict).toBeGreaterThan(0.3);
    expect(crisisShares(1972).conflict).toBeGreaterThan(0.3);
    for (let year = 1976; year <= 2009; year++) expect(crisisShares(year).conflict).toBeUndefined();
    // WPP lists a few dozen violent deaths a year from 2010; they are not a war.
    for (let year = 2010; year <= 2023; year++) expect(crisisShares(year).conflict ?? 0).toBeLessThan(0.001);
  });

  it("covers every war year from 1950 to 1975", () => {
    for (let year = 1950; year <= 1975; year++) expect(crisisShares(year).conflict).toBeGreaterThan(0);
  });

  it("returns an empty object for a quiet year and shares below one half", () => {
    expect(crisisShares(1977)).toEqual({});
    for (let year = 1950; year <= 2023; year++) {
      const total = Object.values(crisisShares(year)).reduce((sum, share) => sum + share, 0);
      expect(total).toBeLessThan(0.5);
    }
  });

  it("knows COVID-19 deaths", () => {
    expect(crisisShares(2021).covid).toBeGreaterThan(0);
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

describe("interpolate and urbanShare", () => {
  const series = { "2000": 10, "2010": 30 };

  it("is linear between published years and flat outside them", () => {
    expect(interpolate(series, 2005)).toBe(20);
    expect(interpolate(series, 1990)).toBe(10);
    expect(interpolate(series, 2030)).toBe(30);
    expect(interpolate({ "2010": 30, "2000": 10 }, 2002)).toBeCloseTo(14, 10);
    expect(() => interpolate({}, 2000)).toThrow();
  });

  it("gives an urban share between 0 and 1 that rises over time", () => {
    expect(urbanShare(1950)).toBe(urbanShare(1960));
    expect(urbanShare(2020)).toBeGreaterThan(urbanShare(1980));
    expect(urbanShare(2020) > 0 && urbanShare(2020) < 1).toBe(true);
  });
});
