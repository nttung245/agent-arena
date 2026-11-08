import { describe, expect, it } from "vitest";
import deathsRaw from "@data/life/vnm/deaths.json";
import {
  CAUSE_GROUPS,
  bandOf,
  causeDistribution,
  causeGroup,
  causeLabel,
  groupFactors,
  groupTargets,
  isChronicCourse,
  pickCause,
  type CauseGroup,
} from "@/game/sim/causes";
import { createRng } from "@/game/sim/rng";
import { crisisShares, type Sex } from "@/game/sim/tables";

const DEATHS = deathsRaw as { firstYear: number; bands: number[] } & Record<Sex, number[][]>;
const SEXES: Sex[] = ["female", "male"];

/** Share of all deaths in a year with a given property, weighted by WPP deaths by age band and sex. */
function nationalShare(year: number, test: (cause: string) => boolean): number {
  const y = year - DEATHS.firstYear;
  let hit = 0;
  let total = 0;
  for (const sex of SEXES) {
    DEATHS[sex][y].forEach((deaths, band) => {
      const age = DEATHS.bands[band];
      for (const { cause, p } of causeDistribution(year, age, sex)) if (test(cause)) hit += deaths * p;
      total += deaths;
    });
  }
  return hit / total;
}

describe("causeDistribution", () => {
  it("sums to 1 for any year, age and sex", () => {
    for (const year of [1950, 1968, 1985, 2010, 2021, 2060]) {
      for (const age of [0, 3, 10, 22, 40, 55, 70, 95]) {
        for (const sex of SEXES) {
          const total = causeDistribution(year, age, sex).reduce((s, c) => s + c.p, 0);
          expect(total).toBeCloseTo(1, 9);
        }
      }
    }
  });

  it("never gives men childbirth deaths, or birth complications after the first year", () => {
    for (const age of [20, 30]) expect(causeDistribution(2000, age, "male").some((c) => c.cause === "maternal")).toBe(false);
    expect(causeDistribution(2000, 25, "female").some((c) => c.cause === "maternal")).toBe(true);
    expect(causeDistribution(2000, 0, "female").some((c) => c.cause === "birth_complications")).toBe(true);
    expect(causeDistribution(2000, 3, "female").some((c) => c.cause === "birth_complications")).toBe(false);
  });

  it("has no war deaths from 1976 to 2009 and no crisis causes in future years", () => {
    for (let year = 1976; year <= 2009; year++) {
      expect(causeDistribution(year, 25, "male").some((c) => c.cause === "conflict")).toBe(false);
    }
    expect(causeDistribution(2060, 80, "female").some((c) => causeGroup(c.cause) === "crisis")).toBe(false);
  });

  it("puts war deaths mostly on young men", () => {
    const share = (age: number, sex: Sex) => causeDistribution(1972, age, sex).find((c) => c.cause === "conflict")?.p ?? 0;
    expect(share(22, "male")).toBeGreaterThan(share(22, "female"));
    expect(share(22, "male")).toBeGreaterThan(share(70, "male"));
  });

  it("makes strokes and cancers the old person's causes and drowning a child's", () => {
    const top = (age: number) =>
      [...causeDistribution(2019, age, "male")].sort((a, b) => b.p - a.p).slice(0, 3).map((c) => c.cause);
    expect(top(80)).toContain("stroke");
    expect(top(3)).toContain("drowning");
  });
});

describe("national calibration", () => {
  it("reproduces the World Bank's group shares in every published year", () => {
    for (const year of [2000, 2010, 2015, 2019, 2021]) {
      const crisis = Object.values(crisisShares(year)).reduce((s, v) => s + v, 0);
      const targets = groupTargets(year);
      for (const group of CAUSE_GROUPS) {
        const share = nationalShare(year, (c) => causeGroup(c) === group) / (1 - crisis);
        expect(Math.abs(share - targets[group])).toBeLessThan(0.002);
      }
    }
  });

  it("reproduces WPP's war share of all deaths in 1968 and 1972", () => {
    for (const year of [1968, 1972]) {
      expect(Math.abs(nationalShare(year, (c) => c === "conflict") - crisisShares(year).conflict!)).toBeLessThan(0.002);
    }
  });

  it("holds group factors steady outside the published years", () => {
    expect(groupFactors(1960)).toEqual(groupFactors(2000));
    expect(groupFactors(2050)).toEqual(groupFactors(2021));
    const mid = groupFactors(2005).chronic;
    const [a, b] = [groupFactors(2000).chronic, groupFactors(2010).chronic];
    expect(mid).toBeGreaterThanOrEqual(Math.min(a, b));
    expect(mid).toBeLessThanOrEqual(Math.max(a, b));
  });

  it("gives the 1960s more infectious deaths than 2019, from child deaths alone", () => {
    const infectious = (year: number) => nationalShare(year, (c) => causeGroup(c) === ("infectious" as CauseGroup));
    expect(infectious(1960)).toBeGreaterThan(infectious(2019));
  });
});

describe("pickCause, labels and flags", () => {
  it("draws causes at the distribution's rates", () => {
    const rng = createRng(3);
    const dist = causeDistribution(2019, 80, "female");
    const counts: Record<string, number> = {};
    const n = 50_000;
    for (let i = 0; i < n; i++) {
      const c = pickCause(rng, 2019, 80, "female");
      counts[c] = (counts[c] ?? 0) + 1;
    }
    for (const { cause, p } of dist) expect(Math.abs((counts[cause] ?? 0) / n - p)).toBeLessThan(0.01);
  });

  it("calls conflict deaths 'the war' until 1975 and 'violence' after", () => {
    expect(causeLabel("conflict", 1968)).toBe("the war");
    expect(causeLabel("conflict", 2015)).toBe("violence");
    expect(causeLabel("stroke", 2000)).toBe("a stroke");
    expect(causeLabel("covid", 2021)).toBe("COVID-19");
    expect(causeLabel("not-a-cause", 2000)).toBe("an illness");
  });

  it("knows which causes come with a long illness", () => {
    expect(isChronicCourse("lung_cancer")).toBe(true);
    expect(isChronicCourse("stroke")).toBe(false);
    expect(isChronicCourse("road")).toBe(false);
    expect(causeGroup("road")).toBe("injury");
    expect(causeGroup("nope")).toBeNull();
  });

  it("maps ages to bands", () => {
    expect([0, 1, 4, 5, 14, 15, 29, 30, 74, 75, 110].map(bandOf)).toEqual([0, 1, 1, 2, 2, 3, 3, 4, 6, 7, 7]);
  });
});
