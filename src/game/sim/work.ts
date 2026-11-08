/**
 * Work: a first job after school (from 15), a sector picked by a multinomial
 * logit over the World Bank's sector shares tilted by schooling and place, job
 * changes that let the workforce follow the shift out of farming, income from
 * the household's income fifth, and retirement. See effects.yaml `work`.
 */
import jobsRaw from "@data/life/jobs.yaml";
import workData from "@data/life/vnm/work.json";
import { EFFECTS } from "@/game/sim/causes";
import { SCHOOL_STAGES, SECTORS, type SchoolStage, type Sector, type SimEvent, type SimState } from "@/game/sim/person";
import { roll, softmaxPick, weightedPick } from "@/game/sim/pick";
import type { Rng } from "@/game/sim/rng";
import { nationalCompletion, universityEntryChance } from "@/game/sim/school";
import { interpolate, urbanShare, type Sex } from "@/game/sim/tables";

const WORK = EFFECTS.work;
const WDI = workData.wdi as Record<string, Record<string, number>>;
const JOBS = jobsRaw as Record<Sector, { title: string; minStage: SchoolStage; from?: number }[]>;

const SECTOR_CODE: Record<Sector, string> = { agriculture: "AGR", industry: "IND", services: "SRV" };
const INCOME_SHARE_CODES = ["SI.DST.FRST.20", "SI.DST.02ND.20", "SI.DST.03RD.20", "SI.DST.04TH.20", "SI.DST.05TH.20"];

/** Share of employed people of this sex working in each sector in a year (0–1). */
export function sectorShares(year: number, sex: Sex): Record<Sector, number> {
  const suffix = sex === "female" ? "FE" : "MA";
  const raw = SECTORS.map((s) => interpolate(WDI[`SL.${SECTOR_CODE[s]}.EMPL.${suffix}.ZS`], year));
  const total = raw.reduce((a, b) => a + b, 0);
  return Object.fromEntries(SECTORS.map((s, i) => [s, raw[i] / total])) as Record<Sector, number>;
}

/** National share of employed people in a sector, both sexes (0–1, World Bank). */
export function nationalSectorShare(sector: Sector, year: number): number {
  return interpolate(WDI[`SL.${SECTOR_CODE[sector]}.EMPL.ZS`], year) / 100;
}

export function retirementAge(sex: Sex, year: number): number {
  const rule = sex === "male" ? WORK.retirement.men : WORK.retirement.women;
  if (year <= 2020) return rule.until2020;
  return Math.min(rule.until2020 + (rule.monthsPerYear * (year - 2020)) / 12, rule.max);
}

/** Yearly income in constant 2021 PPP dollars for this household fifth and schooling. */
export function incomeFor(state: SimState): number {
  const { fifth } = state.person;
  const gdp = interpolate(WDI["NY.GDP.PCAP.PP.KD"], state.year);
  const share = interpolate(WDI[INCOME_SHARE_CODES[fifth - 1]], state.year) / 100;
  return Math.round(gdp * share * 5 * WORK.incomeBySchool[state.education.completed] * state.flags.careerBonus);
}

/**
 * The schooling mix of a typical worker (aged 35) in a year, from the
 * completion rates of the cohort that finished primary school 24 years before.
 */
export function workforceSchooling(year: number): Record<SchoolStage, number> {
  const primaryYear = year - 24;
  const primary = nationalCompletion("primary", primaryYear);
  const lower = Math.min(nationalCompletion("lowerSecondary", primaryYear + 4), primary);
  const upper = Math.min(nationalCompletion("upperSecondary", primaryYear + 7), lower);
  const degree = upper * universityEntryChance(primaryYear + 7) * EFFECTS.school.tertiaryCompletion;
  return {
    none: 1 - primary,
    primary: primary - lower,
    lowerSecondary: lower - upper,
    upperSecondary: upper - degree,
    tertiary: degree,
  };
}

const tiltCache = new Map<number, { school: Record<SchoolStage, Record<Sector, number>>; place: Record<"town" | "village", Record<Sector, number>> }>();

/**
 * The schooling and place tilts, rescaled for the year so each sector's tilt
 * averages 1 over that year's workforce: they move people between sectors
 * without moving the World Bank's national shares.
 */
function tilts(year: number) {
  const key = Math.round(year);
  const cached = tiltCache.get(key);
  if (cached) return cached;
  const schooling = workforceSchooling(key);
  const town = urbanShare(key);
  const school = {} as Record<SchoolStage, Record<Sector, number>>;
  const place = { town: {}, village: {} } as Record<"town" | "village", Record<Sector, number>>;
  for (const stage of SCHOOL_STAGES) school[stage] = {} as Record<Sector, number>;
  for (const sector of SECTORS) {
    const schoolMean = SCHOOL_STAGES.reduce((sum, stage) => sum + schooling[stage] * WORK.sectorBySchool[stage][sector], 0);
    for (const stage of SCHOOL_STAGES) school[stage][sector] = WORK.sectorBySchool[stage][sector] / schoolMean;
    const placeMean = town * WORK.sectorByPlace.town[sector] + (1 - town) * WORK.sectorByPlace.village[sector];
    place.town[sector] = WORK.sectorByPlace.town[sector] / placeMean;
    place.village[sector] = WORK.sectorByPlace.village[sector] / placeMean;
  }
  const result = { school, place };
  tiltCache.set(key, result);
  return result;
}

export function pickSector(state: SimState, rng: Rng, exclude?: Sector): Sector {
  const shares = sectorShares(state.year, state.person.sex);
  const tilt = tilts(state.year);
  const bySchool = tilt.school[state.education.completed];
  const byPlace = tilt.place[state.person.place];
  return softmaxPick(
    rng,
    SECTORS.filter((sector) => sector !== exclude).map((sector) => ({
      key: sector,
      logWeight: Math.log(shares[sector]) + Math.log(bySchool[sector]) + Math.log(byPlace[sector]),
    })),
  );
}

/** Share of a sector's workers who must leave this year for the sector to shrink as the data does. */
export function sectorExitChance(sector: Sector, sex: Sex, year: number): number {
  const before = sectorShares(year - 1, sex)[sector];
  const now = sectorShares(year, sex)[sector];
  return before > 0 ? Math.max(0, 1 - now / before) : 0;
}

/** A job title in the sector that the person's schooling allows; jobs matching it exactly are likelier. */
export function pickJob(sector: Sector, stage: SchoolStage, year: number, rng: Rng): string {
  const level = SCHOOL_STAGES.indexOf(stage);
  const options = JOBS[sector].filter(
    (job) => SCHOOL_STAGES.indexOf(job.minStage) <= level && (job.from === undefined || job.from <= year),
  );
  if (options.length === 0) throw new Error(`no ${sector} job for schooling ${stage} in ${year}`);
  return weightedPick(
    rng,
    options.map((job) => ({ key: job.title, weight: SCHOOL_STAGES.indexOf(job.minStage) === level ? 3 : 1 })),
  );
}

function startJob(
  state: SimState,
  rng: Rng,
  type: "startedWork" | "changedJob",
  exclude?: Sector,
  preferred?: Sector,
): SimEvent {
  const sector = preferred ?? pickSector(state, rng, exclude);
  const job = pickJob(sector, state.education.completed, state.year, rng);
  state.work.sector = sector;
  state.work.job = job;
  state.work.income = incomeFor(state);
  return { type, sector, job };
}

/** True when the person starts work this year (a first-job decision can be offered). */
export function startsWorkThisYear(state: SimState): boolean {
  return state.work.status === "notYet" && state.age >= WORK.minAge && state.education.studying === null;
}

/** True when a wage worker reaches retirement age this year (a decision can be offered). */
export function retiresThisYear(state: SimState): boolean {
  const { work } = state;
  if (work.status !== "working" || work.sector === "agriculture") return false;
  if (state.flags.workUntil !== undefined && state.age < state.flags.workUntil) return false;
  return state.age >= retirementAge(state.person.sex, state.year);
}

/** One year of work: a first job, a possible job change, income, retirement. */
export function rollWork(state: SimState, rng: Rng, choice: { sector?: Sector } = {}): SimEvent[] {
  if (state.ended) return [];
  const { work } = state;
  if (work.status === "notYet") {
    if (state.age < WORK.minAge || state.education.studying !== null) return [];
    work.status = "working";
    work.since = state.year;
    return [startJob(state, rng, "startedWork", undefined, choice.sector)];
  }
  if (work.status !== "working") return [];

  const farmer = work.sector === "agriculture";
  const retire = farmer
    ? state.age >= WORK.retirement.farmerAge || state.stats.health < WORK.retirement.farmerHealthFloor
    : retiresThisYear(state);
  if (retire) {
    work.status = "retired";
    work.income = Math.round(work.income * WORK.retiredIncome);
    return [{ type: "retired" }];
  }
  if (roll(rng, sectorExitChance(work.sector!, state.person.sex, state.year))) {
    return [startJob(state, rng, "changedJob", work.sector)];
  }
  if (roll(rng, WORK.jobChange)) {
    const before = work.job;
    const event = startJob(state, rng, "changedJob");
    return work.job === before ? [] : [event];
  }
  work.income = incomeFor(state);
  return [];
}
