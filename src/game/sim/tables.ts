/**
 * Read-only access to the Viet Nam tables in data/life/vnm/. Years outside a
 * table's range use its nearest year; WPP tables run 1950–2100 (estimates to
 * 2023, then the UN's medium-variant projections).
 */
import fertility from "@data/life/vnm/fertility.json";
import indicators from "@data/life/vnm/indicators.json";
import mortality from "@data/life/vnm/mortality.json";
import { chanceFromRate } from "@/game/sim/pick";

export type Sex = "female" | "male";

interface YearRange {
  firstYear: number;
  lastYear: number;
}

function yearIndex(table: YearRange, year: number): number {
  const y = Math.round(year);
  return Math.min(Math.max(y, table.firstYear), table.lastYear) - table.firstYear;
}

export const DATA_YEARS: Readonly<YearRange> = {
  firstYear: mortality.firstYear,
  lastYear: mortality.lastYear,
};

/** The chance that someone of this sex and age dies within the given calendar year. */
export function deathChance(sex: Sex, year: number, age: number): number {
  const y = yearIndex(mortality, year);
  const a = Math.max(0, Math.floor(age));
  if (a >= mortality.openAge) return chanceFromRate(mortality[sex].m100[y]);
  return mortality[sex].qx[y][a];
}

/** Births per woman of this age in the given year (0 outside ages 15–49). */
export function birthChance(year: number, motherAge: number): number {
  const a = Math.floor(motherAge);
  if (a < fertility.fromAge || a > fertility.toAge) return 0;
  return fertility.asfr[yearIndex(fertility, year)][a - fertility.fromAge];
}

/** Share of births that are boys in the given year. */
export function boyShare(year: number): number {
  const srb = indicators.srb[yearIndex(indicators, year)];
  return srb / (100 + srb);
}

/** The UN's total fertility rate (births per woman over a lifetime at that year's rates). */
export function totalFertilityRate(year: number): number {
  return indicators.tfr[yearIndex(indicators, year)];
}

/** Deaths in thousands in the given year, all causes. */
export function totalDeaths(year: number): number {
  return indicators.deaths[yearIndex(indicators, year)];
}

/**
 * Life expectancy at birth for people born in `birthYear`, living each year at
 * that year's rates (the cohort diagonal). Calibration targets come from this,
 * not from period life expectancy.
 */
export function cohortLifeExpectancy(sex: Sex, birthYear: number): number {
  let alive = 1;
  let years = 0;
  for (let age = 0; age < 130 && alive > 1e-9; age++) {
    const deaths = alive * deathChance(sex, birthYear + age, age);
    const lived = age === 0 ? 0.2 : 0.5;
    years += alive - deaths * (1 - lived);
    alive -= deaths;
  }
  return years;
}

/** Lifetime births per woman for women born in `birthYear` who survive to 50. */
export function cohortFertility(birthYear: number): number {
  let total = 0;
  for (let age = fertility.fromAge; age <= fertility.toAge; age++) {
    total += birthChance(birthYear + age, age);
  }
  return total;
}
