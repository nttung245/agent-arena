/**
 * One simulated year, in a fixed order: relatives' deaths, illness, the
 * person's sudden death, then school, work and family for the living. History
 * and decisions join this loop in engine.ts.
 */
import { rollFamily } from "@/game/sim/family";
import { rollIllness } from "@/game/sim/illness";
import { rollPersonDeath, rollRelativeDeaths } from "@/game/sim/mortality";
import type { SimEvent, SimState } from "@/game/sim/person";
import type { Rng } from "@/game/sim/rng";
import { rollSchool } from "@/game/sim/school";
import { rollWork } from "@/game/sim/work";

export function liveYear(state: SimState, rng: Rng): SimEvent[] {
  if (state.ended) return [];
  const events: SimEvent[] = [...rollRelativeDeaths(state, rng), ...rollIllness(state, rng)];
  if (!state.ended && rollPersonDeath(state, rng)) events.push({ type: "died", cause: state.death!.cause });
  if (state.ended) return events;
  events.push(...rollSchool(state, rng), ...rollWork(state, rng), ...rollFamily(state, rng));
  return events;
}

/** Moves a living person on to their next birthday. */
export function nextYear(state: SimState): void {
  if (state.ended) return;
  state.age++;
  state.year++;
}
