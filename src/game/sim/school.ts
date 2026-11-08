/**
 * School: primary from 6, then lower secondary, upper secondary and university.
 * The chance of finishing each stage follows UNESCO's completion rates for the
 * year the stage ends, adjusted by income fifth and sex; university entry
 * follows the World Bank's tertiary enrolment. See effects.yaml `school`.
 */
import school from "@data/life/vnm/school.json";
import { EFFECTS } from "@/game/sim/causes";
import { SCHOOL_STAGES, type Fifth, type SchoolStage, type SimEvent, type SimState } from "@/game/sim/person";
import { roll, scaleOdds } from "@/game/sim/pick";
import type { Rng } from "@/game/sim/rng";
import { interpolate, type Sex } from "@/game/sim/tables";

const SCHOOL = EFFECTS.school;
const UIS = school.uis as Record<string, Record<string, number>>;
const TERTIARY_ENROLMENT = (school.wdi as Record<string, Record<string, number>>)["SE.TER.ENRR"];

type CountedStage = "primary" | "lowerSecondary" | "upperSecondary";
const UIS_LEVEL: Record<CountedStage, number> = { primary: 1, lowerSecondary: 2, upperSecondary: 3 };

/** UIS breakdown divided by the national total in each survey year both have. */
function ratioSeries(level: number, suffix: string): Record<string, number> {
  const part = UIS[`CR.${level}${suffix}`] ?? {};
  const total = UIS[`CR.${level}`];
  const ratio: Record<string, number> = {};
  for (const year of Object.keys(part)) if (total[year]) ratio[year] = part[year] / total[year];
  return Object.keys(ratio).length > 0 ? ratio : { "2000": 1 };
}

const RATIOS = new Map<string, Record<string, number>>();
function ratio(level: number, suffix: string): Record<string, number> {
  const key = `${level}${suffix}`;
  let series = RATIOS.get(key);
  if (!series) {
    series = ratioSeries(level, suffix);
    RATIOS.set(key, series);
  }
  return series;
}

/**
 * Share of children of this income fifth and sex who finish a stage, for a
 * stage that ends in `finishYear` (unconditional: it includes earlier dropouts).
 */
export function completionRate(stage: CountedStage, finishYear: number, fifth: Fifth, sex: Sex): number {
  const level = UIS_LEVEL[stage];
  const year = finishYear + SCHOOL.surveyLag;
  const base = interpolate(UIS[`CR.${level}`], year) / 100;
  const byFifth = interpolate(ratio(level, `.Q${fifth}`), year);
  const bySex = interpolate(ratio(level, sex === "female" ? ".F" : ".M"), year);
  return Math.min(base * byFifth * bySex, SCHOOL.maxChance);
}

/** National share of children finishing a stage that ends in `finishYear`. */
export function nationalCompletion(stage: CountedStage, finishYear: number): number {
  return interpolate(UIS[`CR.${UIS_LEVEL[stage]}`], finishYear + SCHOOL.surveyLag) / 100;
}

/** Tertiary gross enrolment in a year (0–1, World Bank). */
export function tertiaryEnrolment(year: number): number {
  return interpolate(TERTIARY_ENROLMENT, year) / 100;
}

/** Chance that someone who finished upper secondary in `year` goes on to university. */
export function universityEntryChance(year: number): number {
  const enrolment = interpolate(TERTIARY_ENROLMENT, year) / 100;
  const finishers = nationalCompletion("upperSecondary", year);
  return Math.min(enrolment / finishers, SCHOOL.maxChance);
}

function nextStage(stage: SchoolStage): SchoolStage | null {
  const i = SCHOOL_STAGES.indexOf(stage);
  return i + 1 < SCHOOL_STAGES.length ? SCHOOL_STAGES[i + 1] : null;
}

/** The chance a student finishes the stage they are in now, given they finished the one before. */
export function finishChance(state: SimState): number {
  const stage = state.education.studying;
  if (!stage || stage === "none") return 0;
  if (stage === "tertiary") return SCHOOL.tertiaryCompletion;
  const { fifth, sex } = state.person;
  const now = completionRate(stage, state.year, fifth, sex);
  if (stage === "primary") return now;
  const previous = stage === "lowerSecondary" ? "primary" : "lowerSecondary";
  const before = completionRate(previous, state.year - (SCHOOL.finishAge[stage] - SCHOOL.finishAge[previous]), fifth, sex);
  return Math.min(now / Math.max(before, 0.01), SCHOOL.maxChance);
}

/** Leaves school now, keeping the stages already finished. */
export function leaveSchool(state: SimState): SimEvent {
  state.education.studying = null;
  return { type: "schoolLeft", stage: state.education.completed };
}

/** Choices that change this year's school rolls. */
export interface SchoolChoice {
  /** Multiplies the odds of finishing the current stage. */
  finishOdds?: number;
  /** Multiplies the odds of getting into university. */
  entryOdds?: number;
  /** Don't go on to university even if a place comes. */
  noUniversity?: boolean;
}

/** Odds bonus from years of studying hard: +15% a year, at most double. */
export function studyBonus(state: SimState): number {
  return Math.min(1 + 0.15 * state.flags.studyYears, 2);
}

/** True when the current stage ends this year (a school decision can be offered). */
export function stageEndsThisYear(state: SimState): boolean {
  const stage = state.education.studying;
  return !!stage && stage !== "none" && state.age === SCHOOL.finishAge[stage];
}

/**
 * One year of school. A stage is decided at the age it ends: finish and move
 * on (university needs a separate entry roll), or leave school.
 */
export function rollSchool(state: SimState, rng: Rng, choice: SchoolChoice = {}): SimEvent[] {
  if (state.ended) return [];
  const { education } = state;
  if (education.completed === "none" && education.studying === null && state.age === SCHOOL.startAge) {
    education.studying = "primary";
    return [{ type: "schoolStarted" }];
  }
  const stage = education.studying;
  if (!stage || stage === "none" || state.age !== SCHOOL.finishAge[stage]) return [];
  const finish = scaleOdds(finishChance(state), (choice.finishOdds ?? 1) * studyBonus(state));
  if (!roll(rng, finish)) return [leaveSchool(state)];
  education.completed = stage;
  education.studying = null;
  const events: SimEvent[] = [{ type: "schoolFinished", stage }];
  const next = nextStage(stage);
  if (next === "tertiary") {
    const entry = scaleOdds(universityEntryChance(state.year), (choice.entryOdds ?? 1) * studyBonus(state));
    if (roll(rng, entry) && !choice.noUniversity) education.studying = "tertiary";
  } else if (next) {
    education.studying = next;
  }
  return events;
}
