import { describe, expect, it } from "vitest";
import fertility from "@data/life/vnm/fertility.json";
import indicators from "@data/life/vnm/indicators.json";
import marriage from "@data/life/vnm/marriage.json";
import migration from "@data/life/vnm/migration.json";
import mortality from "@data/life/vnm/mortality.json";
import school from "@data/life/vnm/school.json";
import work from "@data/life/vnm/work.json";

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

describe("school.json", () => {
  it("has UIS completion totals for every stage, in percent", () => {
    for (const code of ["CR.1", "CR.2", "CR.3"]) {
      const values = Object.values(school.uis[code as keyof typeof school.uis]);
      expect(values.length).toBeGreaterThanOrEqual(5);
      for (const v of values) expect(v > 0 && v <= 100).toBe(true);
    }
  });

  it("shows the poorest fifth finishing less often than the richest", () => {
    const poorest = school.uis["CR.2.Q1"];
    const richest = school.uis["CR.2.Q5"];
    for (const year of Object.keys(poorest) as (keyof typeof poorest)[]) {
      if (year in richest) expect(poorest[year]).toBeLessThan(richest[year as keyof typeof richest]);
    }
  });
});

describe("work.json", () => {
  it("has sector shares that add up to about 100% every year", () => {
    const { wdi } = work;
    for (const year of Object.keys(wdi["SL.AGR.EMPL.ZS"]) as (keyof (typeof wdi)["SL.AGR.EMPL.ZS"])[]) {
      const total = wdi["SL.AGR.EMPL.ZS"][year] + wdi["SL.IND.EMPL.ZS"][year] + wdi["SL.SRV.EMPL.ZS"][year];
      expect(Math.abs(total - 100)).toBeLessThan(0.5);
    }
  });

  it("has income shares by fifth that add up to about 100%", () => {
    const { wdi } = work;
    for (const year of Object.keys(wdi["SI.DST.FRST.20"]) as (keyof (typeof wdi)["SI.DST.FRST.20"])[]) {
      const total =
        wdi["SI.DST.FRST.20"][year] +
        wdi["SI.DST.02ND.20"][year] +
        wdi["SI.DST.03RD.20"][year] +
        wdi["SI.DST.04TH.20"][year] +
        wdi["SI.DST.05TH.20"][year];
      expect(Math.abs(total - 100)).toBeLessThan(0.5);
    }
  });
});

describe("marriage.json", () => {
  it("has shares between 0 and 1 that mostly rise with age", () => {
    for (const sex of SEXES) {
      for (const groups of Object.values(marriage.everMarried[sex]) as Record<string, number>[]) {
        const values = Object.keys(groups)
          .map(Number)
          .sort((a, b) => a - b)
          .map((age) => groups[age]);
        for (const v of values) expect(v >= 0 && v <= 1).toBe(true);
        expect(values[values.length - 1]).toBeGreaterThan(values[0]);
      }
    }
  });
});

describe("migration.json", () => {
  it("has a stock per destination for every year, the US largest in 2024", () => {
    const { years, destinations } = migration.emigrantStock;
    for (const counts of Object.values(destinations)) expect(counts).toHaveLength(years.length);
    const last = years.length - 1;
    const largest = Object.entries(destinations)
      .filter(([name]) => name !== "Other")
      .sort(([, a], [, b]) => b[last] - a[last])[0][0];
    expect(largest).toBe("United States of America");
  });

  it("has an urban share that grows from 1960 to 2025", () => {
    expect(migration.urbanShare["2025"]).toBeGreaterThan(migration.urbanShare["1960"]);
  });
});
