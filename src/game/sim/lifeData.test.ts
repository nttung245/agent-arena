import { describe, expect, it } from "vitest";
import fertility from "@data/life/vnm/fertility.json";
import indicators from "@data/life/vnm/indicators.json";
import mortality from "@data/life/vnm/mortality.json";

const YEARS = mortality.lastYear - mortality.firstYear + 1;
const SEXES = ["female", "male"] as const;

/** Period life expectancy at birth from single-age qx and the open 100+ rate. */
function lifeExpectancy(qx: number[], m100: number): number {
  let alive = 1;
  let years = 0;
  qx.forEach((q, age) => {
    const lived = age === 0 ? 0.2 : 0.5; // average part of the year lived by those who die
    const deaths = alive * q;
    years += alive - deaths * (1 - lived);
    alive -= deaths;
  });
  return years + alive / m100;
}

function e0(sex: (typeof SEXES)[number], year: number): number {
  const i = year - mortality.firstYear;
  return lifeExpectancy(mortality[sex].qx[i], mortality[sex].m100[i]);
}

describe("mortality.json", () => {
  it("has a full single-age table for every year and sex", () => {
    for (const sex of SEXES) {
      expect(mortality[sex].qx).toHaveLength(YEARS);
      expect(mortality[sex].m100).toHaveLength(YEARS);
      for (const row of mortality[sex].qx) {
        expect(row).toHaveLength(mortality.openAge);
        for (const q of row) expect(q > 0 && q < 1).toBe(true);
      }
      for (const m of mortality[sex].m100) expect(m).toBeGreaterThan(0);
    }
  });

  it("reproduces the UN's life expectancy in every year from 1950 to 2100", () => {
    for (let year = mortality.firstYear; year <= mortality.lastYear; year++) {
      const i = year - indicators.firstYear;
      expect(Math.abs(e0("female", year) - indicators.lexFemale[i])).toBeLessThan(0.3);
      expect(Math.abs(e0("male", year) - indicators.lexMale[i])).toBeLessThan(0.3);
    }
  });

  it("carries the war years' deaths (1968 and 1972 dip below the year before)", () => {
    expect(e0("male", 1968)).toBeLessThan(e0("male", 1967) - 2);
    expect(e0("male", 1972)).toBeLessThan(e0("male", 1971) - 2);
  });
});

describe("fertility.json", () => {
  it("adds up to the UN's total fertility rate in every year", () => {
    expect(fertility.asfr).toHaveLength(YEARS);
    fertility.asfr.forEach((row, i) => {
      expect(row).toHaveLength(fertility.toAge - fertility.fromAge + 1);
      const total = row.reduce((sum, rate) => sum + rate, 0);
      expect(Math.abs(total - indicators.tfr[i])).toBeLessThan(0.02);
    });
  });
});

describe("indicators.json", () => {
  it("has a plausible sex ratio at birth in every year", () => {
    expect(indicators.srb).toHaveLength(YEARS);
    for (const srb of indicators.srb) {
      expect(srb).toBeGreaterThan(100);
      expect(srb).toBeLessThan(120);
    }
  });
});
