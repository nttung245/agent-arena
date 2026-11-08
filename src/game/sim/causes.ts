/**
 * Causes of death. When someone dies, the cause is drawn from a distribution
 * that depends on year, age and sex, and that reproduces the sourced national
 * totals:
 *
 * 1. Crisis deaths (war, storms and floods, epidemics, COVID-19) take each
 *    year's WPP share of all deaths, spread over ages and sexes by estimated
 *    weights and rescaled so the national share is exact.
 * 2. The rest split into the World Bank's three groups (infectious, chronic,
 *    injury) by an estimated age pattern, with whole groups rescaled each year
 *    (raking) so the national shares match the World Bank's.
 * 3. Within a group, a named cause by estimated weights.
 *
 * Self-harm is never a named cause: those deaths are spread across the other
 * injury causes, so all-cause mortality is unchanged.
 */
import effectsRaw from "@data/life/effects.yaml";
import causesRaw from "@data/life/vnm/causes.json";
import deathsRaw from "@data/life/vnm/deaths.json";
import type { SchoolStage, Sector } from "@/game/sim/person";
import { weightedPick } from "@/game/sim/pick";
import type { Rng } from "@/game/sim/rng";
import { crisisShares, interpolate, type CrisisKind, type Sex } from "@/game/sim/tables";

export type CauseGroup = "infectious" | "chronic" | "injury";
export const CAUSE_GROUPS: readonly CauseGroup[] = ["infectious", "chronic", "injury"];
export const CRISIS_KINDS: readonly CrisisKind[] = ["conflict", "disaster", "epidemic", "covid"];

interface NamedCause {
  label: string;
  weights: number[];
  sex?: Partial<Record<Sex, number>>;
  course?: "chronic";
}

interface CrisisEffect {
  label: string;
  laterLabel?: string;
  warUntil?: number;
  weights: Record<Sex, number[]>;
}

export interface IllnessCourse {
  /** Mean years from diagnosis to the end of the illness (recovery or death). */
  years: number;
  /** Share of people diagnosed who recover. */
  cure: number;
}

export interface Effects {
  mortality: { multipliers: { fifth: number[]; place: { town: number; village: number } } };
  family: {
    partnerGapMin: number;
    partnerGapMax: number;
    divorce: { before: number; from: number; year: number };
    repartner: { chance: number; maxAge: number };
    maxBirthChance: number;
  };
  school: {
    finishAge: Record<Exclude<SchoolStage, "none">, number>;
    startAge: number;
    surveyLag: number;
    tertiaryCompletion: number;
    maxChance: number;
  };
  work: {
    minAge: number;
    jobChange: number;
    retiredIncome: number;
    sectorBySchool: Record<SchoolStage, Record<Sector, number>>;
    sectorByPlace: Record<"town" | "village", Record<Sector, number>>;
    incomeBySchool: Record<SchoolStage, number>;
    retirement: {
      men: { until2020: number; monthsPerYear: number; max: number };
      women: { until2020: number; monthsPerYear: number; max: number };
      farmerAge: number;
      farmerHealthFloor: number;
    };
  };
  illness: {
    courses: Record<string, IllnessCourse>;
    treatment: { death: number; recovery: number };
    healthLossPerYear: number;
    healthGainOnRecovery: number;
  };
  causes: {
    bands: number[];
    groups: Record<CauseGroup, number[]> & { sex: Partial<Record<CauseGroup, Partial<Record<Sex, number>>>> };
    named: Record<CauseGroup, Record<string, NamedCause>>;
    crises: Record<CrisisKind, CrisisEffect>;
  };
}

export const EFFECTS = effectsRaw as Effects;
const CAUSES = EFFECTS.causes;
const DEATHS = deathsRaw as { firstYear: number; lastYear: number; bands: number[] } & Record<Sex, number[][]>;
const WDI = (causesRaw as { wdi: Record<string, Record<string, number>> }).wdi;

const WDI_CODES: Record<CauseGroup, string> = {
  infectious: "SH.DTH.COMM.ZS",
  chronic: "SH.DTH.NCOM.ZS",
  injury: "SH.DTH.INJR.ZS",
};
/** Which World Bank group each crisis's deaths are counted in. */
const CRISIS_GROUP: Record<CrisisKind, CauseGroup> = {
  conflict: "injury",
  disaster: "injury",
  epidemic: "infectious",
  covid: "infectious",
};
const SEXES: readonly Sex[] = ["female", "male"];
const MAX_CRISIS_SHARE = 0.9;

if (CAUSES.bands.join() !== DEATHS.bands.join()) {
  throw new Error("effects.yaml cause bands must match deaths.json bands");
}

export type CauseId = string;

const NAMED_INDEX = new Map<CauseId, { group: CauseGroup; cause: NamedCause }>();
for (const group of CAUSE_GROUPS) {
  for (const [id, cause] of Object.entries(CAUSES.named[group])) NAMED_INDEX.set(id, { group, cause });
}

export function bandOf(age: number): number {
  let band = 0;
  while (band + 1 < CAUSES.bands.length && age >= CAUSES.bands[band + 1]) band++;
  return band;
}

function deathsIn(year: number): Record<Sex, number[]> {
  const y = Math.min(Math.max(Math.round(year), DEATHS.firstYear), DEATHS.lastYear) - DEATHS.firstYear;
  return { female: DEATHS.female[y], male: DEATHS.male[y] };
}

function sum(values: readonly number[]): number {
  return values.reduce((total, v) => total + v, 0);
}

type CellTable = Record<Sex, number[]>;

const crisisCache = new Map<number, Partial<Record<CrisisKind, CellTable>>>();

/**
 * P(this death was from crisis k | sex, age band, year), rescaled so that,
 * over WPP's deaths by age and sex, crisis k's share of all deaths is exact.
 */
function crisisProbabilities(year: number): Partial<Record<CrisisKind, CellTable>> {
  const key = Math.round(year);
  const cached = crisisCache.get(key);
  if (cached) return cached;
  const shares = crisisShares(key);
  const deaths = deathsIn(key);
  const total = sum(deaths.female) + sum(deaths.male);
  const result: Partial<Record<CrisisKind, CellTable>> = {};
  for (const kind of CRISIS_KINDS) {
    const share = shares[kind];
    if (!share) continue;
    const weights = CAUSES.crises[kind].weights;
    // Water-filling: cells that would pass the cap sit at the cap, and the rest
    // of the crisis's deaths spread over the other cells, so the national share stays exact.
    const capped = new Set<string>();
    let scale = 0;
    for (let pass = 0; pass < 2 * CAUSES.bands.length + 1; pass++) {
      let weighted = 0;
      let cappedDeaths = 0;
      for (const sex of SEXES) {
        deaths[sex].forEach((d, band) => {
          if (capped.has(`${sex}${band}`)) cappedDeaths += d * MAX_CRISIS_SHARE;
          else weighted += d * weights[sex][band];
        });
      }
      scale = weighted > 0 ? (share * total - cappedDeaths) / weighted : 0;
      let changed = false;
      for (const sex of SEXES) {
        weights[sex].forEach((w, band) => {
          if (!capped.has(`${sex}${band}`) && w * scale > MAX_CRISIS_SHARE) {
            capped.add(`${sex}${band}`);
            changed = true;
          }
        });
      }
      if (!changed) break;
    }
    const cell = (sex: Sex) =>
      weights[sex].map((w, band) => (capped.has(`${sex}${band}`) ? MAX_CRISIS_SHARE : w * scale));
    result[kind] = { female: cell("female"), male: cell("male") };
  }
  // Several crises in one cell together can't pass the cap either; trim proportionally (rare).
  for (const sex of SEXES) {
    for (let band = 0; band < CAUSES.bands.length; band++) {
      const cellTotal = CRISIS_KINDS.reduce((t, k) => t + (result[k]?.[sex][band] ?? 0), 0);
      if (cellTotal > MAX_CRISIS_SHARE) {
        for (const k of CRISIS_KINDS) if (result[k]) result[k]![sex][band] *= MAX_CRISIS_SHARE / cellTotal;
      }
    }
  }
  crisisCache.set(key, result);
  return result;
}

function groupWeight(group: CauseGroup, sex: Sex, band: number): number {
  return CAUSES.groups[group][band] * (CAUSES.groups.sex[group]?.[sex] ?? 1);
}

/** Years with all three World Bank group shares. */
const WDI_YEARS: number[] = Object.keys(WDI[WDI_CODES.infectious])
  .map(Number)
  .filter((y) => CAUSE_GROUPS.every((g) => String(y) in WDI[WDI_CODES[g]]))
  .sort((a, b) => a - b);

/** The World Bank group shares of non-crisis deaths in a published year. */
export function groupTargets(year: number): Record<CauseGroup, number> {
  const shares = crisisShares(year);
  const raw = Object.fromEntries(
    CAUSE_GROUPS.map((g) => {
      let share = WDI[WDI_CODES[g]][String(year)] / 100;
      for (const kind of CRISIS_KINDS) if (CRISIS_GROUP[kind] === g) share -= shares[kind] ?? 0;
      return [g, Math.max(share, 1e-6)];
    }),
  ) as Record<CauseGroup, number>;
  const total = sum(CAUSE_GROUPS.map((g) => raw[g]));
  return Object.fromEntries(CAUSE_GROUPS.map((g) => [g, raw[g] / total])) as Record<CauseGroup, number>;
}

function groupProbabilities(factors: Record<CauseGroup, number>, sex: Sex, band: number): Record<CauseGroup, number> {
  const weights = CAUSE_GROUPS.map((g) => groupWeight(g, sex, band) * factors[g]);
  const total = sum(weights);
  return Object.fromEntries(CAUSE_GROUPS.map((g, i) => [g, weights[i] / total])) as Record<CauseGroup, number>;
}

/** Rakes the group factors so non-crisis deaths match the World Bank's shares in a published year. */
function rakeGroupFactors(year: number): Record<CauseGroup, number> {
  const targets = groupTargets(year);
  const deaths = deathsIn(year);
  const crises = crisisProbabilities(year);
  const cells: { sex: Sex; band: number; deaths: number }[] = [];
  for (const sex of SEXES) {
    deaths[sex].forEach((d, band) => {
      const crisis = CRISIS_KINDS.reduce((t, k) => t + (crises[k]?.[sex][band] ?? 0), 0);
      cells.push({ sex, band, deaths: d * (1 - crisis) });
    });
  }
  const total = sum(cells.map((c) => c.deaths));
  const factors: Record<CauseGroup, number> = { infectious: 1, chronic: 1, injury: 1 };
  for (let iteration = 0; iteration < 200; iteration++) {
    const current: Record<CauseGroup, number> = { infectious: 0, chronic: 0, injury: 0 };
    for (const cell of cells) {
      const p = groupProbabilities(factors, cell.sex, cell.band);
      for (const g of CAUSE_GROUPS) current[g] += (cell.deaths * p[g]) / total;
    }
    for (const g of CAUSE_GROUPS) factors[g] *= targets[g] / current[g];
  }
  const base = factors.infectious;
  for (const g of CAUSE_GROUPS) factors[g] /= base;
  return factors;
}

const RAKED: Map<number, Record<CauseGroup, number>> = new Map();

/**
 * Group factors for any year: raked in published years, interpolated between
 * them (in log space), and held at the nearest published year outside them.
 * Holding the age-standardized factor, not the national share, lets earlier
 * decades with many child deaths show more infectious deaths on their own.
 */
export function groupFactors(year: number): Record<CauseGroup, number> {
  const raked = (y: number) => {
    let factors = RAKED.get(y);
    if (!factors) {
      factors = rakeGroupFactors(y);
      RAKED.set(y, factors);
    }
    return factors;
  };
  return Object.fromEntries(
    CAUSE_GROUPS.map((g) => {
      const series = Object.fromEntries(WDI_YEARS.map((y) => [String(y), Math.log(raked(y)[g])]));
      return [g, Math.exp(interpolate(series, year))];
    }),
  ) as Record<CauseGroup, number>;
}

export interface CauseChance {
  cause: CauseId;
  p: number;
}

const distributionCache = new Map<number, readonly CauseChance[]>();
const BAND_COUNT = CAUSES.bands.length;

function cellKey(year: number, band: number, sex: Sex): number {
  return (Math.round(year) * BAND_COUNT + band) * 2 + (sex === "male" ? 1 : 0);
}

/** The full distribution of causes for a death at this year, age and sex. Sums to 1. */
export function causeDistribution(year: number, age: number, sex: Sex): readonly CauseChance[] {
  const band = bandOf(age);
  const key = cellKey(year, band, sex);
  const cached = distributionCache.get(key);
  if (cached) return cached;
  const result = buildDistribution(Math.round(year), band, sex);
  distributionCache.set(key, result);
  return result;
}

function buildDistribution(year: number, band: number, sex: Sex): readonly CauseChance[] {
  const out: CauseChance[] = [];
  const crises = crisisProbabilities(year);
  let crisisTotal = 0;
  for (const kind of CRISIS_KINDS) {
    const p = crises[kind]?.[sex][band] ?? 0;
    if (p > 0) {
      out.push({ cause: kind, p });
      crisisTotal += p;
    }
  }
  const rest = 1 - crisisTotal;
  const groups = groupProbabilities(groupFactors(year), sex, band);
  for (const g of CAUSE_GROUPS) {
    const named = Object.entries(CAUSES.named[g]).map(([id, cause]) => ({
      id,
      weight: cause.weights[band] * (cause.sex?.[sex] ?? 1),
    }));
    const total = sum(named.map((n) => n.weight));
    if (!(total > 0)) continue;
    for (const n of named) {
      if (n.weight > 0) out.push({ cause: n.id, p: (rest * groups[g] * n.weight) / total });
    }
  }
  const norm = sum(out.map((c) => c.p));
  return Object.freeze(out.map((c) => Object.freeze({ cause: c.cause, p: c.p / norm })));
}

/**
 * Draws a cause for a death at this year, age and sex. With `sudden`, long
 * illnesses are left out: those deaths come only through an illness's course.
 */
export function pickCause(rng: Rng, year: number, age: number, sex: Sex, options: { sudden?: boolean } = {}): CauseId {
  const candidates = causeDistribution(year, age, sex).filter((c) => !options.sudden || !isChronicCourse(c.cause));
  return weightedPick(
    rng,
    candidates.map((c) => ({ key: c.cause, weight: c.p })),
  );
}

const chronicCache = new Map<number, number>();

/** Share of deaths at this year, age and sex that come from long illnesses. */
export function chronicShare(year: number, age: number, sex: Sex): number {
  const key = cellKey(year, bandOf(age), sex);
  let share = chronicCache.get(key);
  if (share === undefined) {
    share = causeDistribution(year, age, sex)
      .filter((c) => isChronicCourse(c.cause))
      .reduce((total, c) => total + c.p, 0);
    chronicCache.set(key, share);
  }
  return share;
}

/** Share of deaths at this year, age and sex from one cause. */
export function causeShare(cause: CauseId, year: number, age: number, sex: Sex): number {
  return causeDistribution(year, age, sex).find((c) => c.cause === cause)?.p ?? 0;
}

export function isCrisisCause(cause: CauseId): cause is CrisisKind {
  return (CRISIS_KINDS as readonly string[]).includes(cause);
}

/** The group a named cause belongs to, "crisis", or null for an unknown id. */
export function causeGroup(cause: CauseId): CauseGroup | "crisis" | null {
  if (isCrisisCause(cause)) return "crisis";
  return NAMED_INDEX.get(cause)?.group ?? null;
}

/** True for illnesses that come with a diagnosis and a decline before death. */
export function isChronicCourse(cause: CauseId): boolean {
  return NAMED_INDEX.get(cause)?.cause.course === "chronic";
}

/** Plain words for a cause, as the journal shows it ("a stroke", "the war"). */
export function causeLabel(cause: CauseId, year: number): string {
  if (isCrisisCause(cause)) {
    const effect = CAUSES.crises[cause];
    if (effect.warUntil !== undefined && year > effect.warUntil && effect.laterLabel) return effect.laterLabel;
    return effect.label;
  }
  return NAMED_INDEX.get(cause)?.cause.label ?? "an illness";
}
