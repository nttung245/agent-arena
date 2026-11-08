/**
 * Read-only access to the Viet Nam tables in data/life/vnm/. Years outside a
 * table's range use its nearest year; WPP tables run 1950–2100 (estimates to
 * 2023, then the UN's medium-variant projections).
 */
import crises from "@data/life/vnm/crises.json";
import fertility from "@data/life/vnm/fertility.json";
import indicators from "@data/life/vnm/indicators.json";
import marriage from "@data/life/vnm/marriage.json";
import migration from "@data/life/vnm/migration.json";
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

/**
 * Reads a sparse series ({ "1999": 85.7, "2002": 89.1, ... }) at any year:
 * linear between published years, and the nearest published value outside
 * them. Values outside the published years are estimates.
 */
const sortedSeries = new WeakMap<object, readonly (readonly [number, number])[]>();

export function interpolate(series: Readonly<Record<string, number>>, year: number): number {
  let points = sortedSeries.get(series);
  if (!points) {
    points = Object.entries(series)
      .map(([key, value]) => [Number(key), value] as const)
      .sort((a, b) => a[0] - b[0]);
    sortedSeries.set(series, points);
  }
  if (points.length === 0) throw new Error("interpolate: empty series");
  if (year <= points[0][0]) return points[0][1];
  const last = points[points.length - 1];
  if (year >= last[0]) return last[1];
  for (let i = 1; i < points.length; i++) {
    const [x1, y1] = points[i];
    if (year <= x1) {
      const [x0, y0] = points[i - 1];
      return y0 + ((y1 - y0) * (year - x0)) / (x1 - x0);
    }
  }
  return last[1];
}

/** Share of Viet Nam's population living in towns and cities (0–1). Before 1960, the 1960 value. */
export function urbanShare(year: number): number {
  return interpolate(migration.urbanShare, year) / 100;
}

type MarriageTable = Record<Sex, Record<string, Record<string, number>>>;
const EVER_MARRIED = marriage.everMarried as MarriageTable;
const marriageYears: Record<Sex, number[]> = {
  female: Object.keys(EVER_MARRIED.female).map(Number).sort((a, b) => a - b),
  male: Object.keys(EVER_MARRIED.male).map(Number).sort((a, b) => a - b),
};

/** One survey's share ever married at an exact age: linear between 5-year group midpoints, 0 at 15. */
function everMarriedInSurvey(groups: Record<string, number>, age: number): number {
  const points: [number, number][] = [[15, 0]];
  for (const start of Object.keys(groups).map(Number).sort((a, b) => a - b)) {
    points.push([start + 2.5, groups[String(start)]]);
  }
  if (age <= points[0][0]) return 0;
  for (let i = 1; i < points.length; i++) {
    const [x1, y1] = points[i];
    if (age <= x1) {
      const [x0, y0] = points[i - 1];
      return y0 + ((y1 - y0) * (age - x0)) / (x1 - x0);
    }
  }
  return points[points.length - 1][1];
}

/**
 * Share of people of this sex who have ever married by an exact age, in the
 * given year: interpolated between survey years (UN World Marriage Data),
 * held at the nearest survey outside 1988–2015.
 */
export function everMarried(sex: Sex, year: number, age: number): number {
  const years = marriageYears[sex];
  const at = (y: number) => everMarriedInSurvey(EVER_MARRIED[sex][String(y)], age);
  if (year <= years[0]) return at(years[0]);
  if (year >= years[years.length - 1]) return at(years[years.length - 1]);
  for (let i = 1; i < years.length; i++) {
    if (year <= years[i]) {
      const [y0, y1] = [years[i - 1], years[i]];
      return at(y0) + ((at(y1) - at(y0)) * (year - y0)) / (y1 - y0);
    }
  }
  return at(years[years.length - 1]);
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

/** Population on 1 July in thousands. */
export function population(year: number): number {
  return indicators.population[yearIndex(indicators, year)];
}

/** Deaths in thousands in the given year, all causes. */
export function totalDeaths(year: number): number {
  return indicators.deaths[yearIndex(indicators, year)];
}

export type CrisisKind = "conflict" | "disaster" | "epidemic" | "covid";

const CRISIS_YEARS = crises.years as Record<
  string,
  Partial<Record<CrisisKind, { deaths: number; share: number }>>
>;

/**
 * Each crisis kind's share of all deaths in the given year (WPP). These deaths
 * are already inside deathChance(); a death is attributed to a crisis by share,
 * never added on top. Years with no crisis return an empty object.
 */
export function crisisShares(year: number): Partial<Record<CrisisKind, number>> {
  const entry = CRISIS_YEARS[String(Math.round(year))];
  if (!entry) return {};
  const shares: Partial<Record<CrisisKind, number>> = {};
  for (const [kind, value] of Object.entries(entry) as [CrisisKind, { share: number }][]) {
    shares[kind] = value.share;
  }
  return shares;
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
