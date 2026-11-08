/**
 * Yearly death rolls for the person and everyone in their family. The chance
 * comes from the UN life table for that year, age and sex, adjusted by the
 * household's income fifth and town/village (rescaled to average 1, so the
 * national rate is unchanged). The cause comes from causes.ts.
 */
import { EFFECTS, pickCause } from "@/game/sim/causes";
import type { Fifth, Person, Place, Relative, SimState } from "@/game/sim/person";
import { meanOne, roll, scaleChance } from "@/game/sim/pick";
import type { Rng } from "@/game/sim/rng";
import { deathChance, urbanShare } from "@/game/sim/tables";

const MULTIPLIERS = EFFECTS.mortality.multipliers;

const FIFTH_MULTIPLIER = meanOne(
  { "1": MULTIPLIERS.fifth[0], "2": MULTIPLIERS.fifth[1], "3": MULTIPLIERS.fifth[2], "4": MULTIPLIERS.fifth[3], "5": MULTIPLIERS.fifth[4] },
  { "1": 0.2, "2": 0.2, "3": 0.2, "4": 0.2, "5": 0.2 },
);

function placeMultiplier(place: Place, year: number): number {
  const town = urbanShare(year);
  return meanOne(MULTIPLIERS.place, { town, village: 1 - town })[place];
}

/** How much this household's situation moves the UN death rate (about 0.7–1.4). */
export function householdMultiplier(fifth: Fifth, place: Place, year: number): number {
  return FIFTH_MULTIPLIER[String(fifth) as keyof typeof FIFTH_MULTIPLIER] * placeMultiplier(place, year);
}

export function personDeathChance(state: SimState): number {
  const { person, year, age } = state;
  return scaleChance(deathChance(person.sex, year, age), householdMultiplier(person.fifth, person.place, year));
}

/**
 * Rolls the person's death for the current year. On death it records the age,
 * year and cause and ends the life; it returns true if the person died.
 */
export function rollPersonDeath(state: SimState, rng: Rng): boolean {
  if (state.ended) return false;
  if (!roll(rng, personDeathChance(state))) return false;
  state.ended = true;
  state.death = { age: state.age, year: state.year, cause: pickCause(rng, state.year, state.age, state.person.sex) };
  return true;
}

function relativeDeathChance(relative: Relative, person: Person, year: number): number {
  return scaleChance(
    deathChance(relative.sex, year, year - relative.birthYear),
    householdMultiplier(person.fifth, person.place, year),
  );
}

/** Rolls this year's death for every living relative; returns those who died. */
export function rollRelativeDeaths(state: SimState, rng: Rng): Relative[] {
  const died: Relative[] = [];
  for (const relative of state.relatives) {
    if (!relative.alive || relative.birthYear > state.year) continue;
    if (!roll(rng, relativeDeathChance(relative, state.person, state.year))) continue;
    relative.alive = false;
    relative.diedYear = state.year;
    relative.cause = pickCause(rng, state.year, state.year - relative.birthYear, relative.sex);
    died.push(relative);
  }
  return died;
}
