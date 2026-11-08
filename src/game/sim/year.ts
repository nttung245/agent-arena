/**
 * One simulated year, in a fixed order: history, relatives' deaths, illness,
 * the person's sudden death, then school, work, family and moves for the
 * living. Decisions join this loop in engine.ts.
 */
import { rollFamily } from "@/game/sim/family";
import { rollHistory } from "@/game/sim/history";
import { rollMigration } from "@/game/sim/migration";
import { rollIllness } from "@/game/sim/illness";
import { rollPersonDeath, rollRelativeDeaths } from "@/game/sim/mortality";
import type { SimEvent, SimState } from "@/game/sim/person";
import type { Rng } from "@/game/sim/rng";
import { rollSchool } from "@/game/sim/school";
import { rollWork } from "@/game/sim/work";

export function liveYear(state: SimState, rng: Rng): SimEvent[] {
  if (state.ended) return [];
  const events: SimEvent[] = [
    ...rollHistory(state, rng),
    ...rollRelativeDeaths(state, rng),
    ...rollIllness(state, rng),
  ];
  if (!state.ended && rollPersonDeath(state, rng)) events.push({ type: "died", cause: state.death!.cause });
  if (state.ended) return events;
  events.push(
    ...rollSchool(state, rng),
    ...rollWork(state, rng),
    ...rollFamily(state, rng),
    ...rollMigration(state, rng),
  );
  return events;
}

/** Moves a living person on to their next birthday. */
export function nextYear(state: SimState): void {
  if (state.ended) return;
  state.age++;
  state.year++;
}
