/**
 * Long illnesses: a diagnosis, years of decline, then recovery or death.
 *
 * For each illness, a diagnosis at age a uses that cause's death rate at age
 * a + years (when the illness would end), divided by the share who die of it.
 * Diagnosed people then leave the illness at rate 1 / years, dying with
 * probability 1 − cure. Together these keep deaths from the illness close to
 * its share of deaths by age, while the death itself arrives years after the
 * diagnosis. Treatment lowers the death rate and raises the recovery rate.
 */
import { EFFECTS, causeDistribution, isChronicCourse, type CauseId, type IllnessCourse } from "@/game/sim/causes";
import { householdMultiplier } from "@/game/sim/mortality";
import type { Illness, SimEvent, SimState } from "@/game/sim/person";
import { chanceFromRate, roll, scaleChance } from "@/game/sim/pick";
import type { Rng } from "@/game/sim/rng";
import { deathChance, type Sex } from "@/game/sim/tables";

const ILLNESS = EFFECTS.illness;
export const CHRONIC_CAUSES: readonly CauseId[] = Object.keys(ILLNESS.courses);

for (const cause of CHRONIC_CAUSES) {
  if (!isChronicCourse(cause)) throw new Error(`effects.yaml: illness course for ${cause}, which is not a chronic cause`);
}

export function illnessCourse(cause: CauseId): IllnessCourse {
  const course = ILLNESS.courses[cause];
  if (!course) throw new Error(`no illness course for ${cause}`);
  return course;
}

/** Share of deaths at this year, age and sex from one cause. */
function causeShare(cause: CauseId, year: number, age: number, sex: Sex): number {
  return causeDistribution(year, age, sex).find((c) => c.cause === cause)?.p ?? 0;
}

/** Chance of being diagnosed with this illness this year (before household adjustment). */
export function onsetChance(cause: CauseId, sex: Sex, year: number, age: number): number {
  const course = illnessCourse(cause);
  const lead = Math.round(course.years);
  const deathsLater = deathChance(sex, year + lead, age + lead) * causeShare(cause, year + lead, age + lead, sex);
  return Math.min(deathsLater / Math.max(1 - course.cure, 0.05), 0.5);
}

/** Yearly rates of leaving the illness by death and by recovery. */
export function exitRates(illness: Illness): { death: number; recovery: number } {
  const course = illnessCourse(illness.cause);
  const exit = 1 / course.years;
  const death = exit * (1 - course.cure) * (illness.treated ? ILLNESS.treatment.death : 1);
  const recovery = exit * course.cure * (illness.treated ? ILLNESS.treatment.recovery : 1);
  return { death, recovery };
}

function clampStat(value: number): number {
  return Math.min(100, Math.max(0, Math.round(value)));
}

/**
 * One year of illness for the person: existing illnesses end in recovery or
 * death or go on (health declines), then new diagnoses are rolled. A death
 * here ends the life with the illness as the cause.
 */
export function rollIllness(state: SimState, rng: Rng): SimEvent[] {
  if (state.ended) return [];
  const events: SimEvent[] = [];
  const { person, year, age } = state;

  for (const illness of [...state.illnesses]) {
    if (illness.since === year) continue; // diagnosed this year; its course starts next year
    const { death, recovery } = exitRates(illness);
    if (roll(rng, chanceFromRate(death + recovery))) {
      if (rng.next() < death / (death + recovery)) {
        state.ended = true;
        state.death = { age, year, cause: illness.cause };
        events.push({ type: "died", cause: illness.cause });
        return events;
      }
      state.illnesses = state.illnesses.filter((i) => i !== illness);
      state.stats.health = clampStat(state.stats.health + ILLNESS.healthGainOnRecovery);
      events.push({ type: "recovered", cause: illness.cause });
    } else {
      state.stats.health = clampStat(state.stats.health - ILLNESS.healthLossPerYear);
      events.push({ type: "worsened", cause: illness.cause });
    }
  }

  const multiplier = householdMultiplier(person.fifth, person.place, year);
  for (const cause of CHRONIC_CAUSES) {
    if (state.illnesses.some((i) => i.cause === cause)) continue;
    if (!roll(rng, scaleChance(onsetChance(cause, person.sex, year, age), multiplier))) continue;
    state.illnesses.push({ cause, since: year, treated: false });
    events.push({ type: "diagnosed", cause });
  }
  return events;
}

/** Starts treatment for an illness the person has. Returns false if they don't have it. */
export function treatIllness(state: SimState, cause: CauseId): boolean {
  const illness = state.illnesses.find((i) => i.cause === cause);
  if (!illness) return false;
  illness.treated = true;
  return true;
}
