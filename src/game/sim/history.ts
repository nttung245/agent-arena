/**
 * History: what each year in Viet Nam brought, by region and who you were.
 * Rows live in data/life/history.yaml. They add journal lines and moves; they
 * never change the chance of dying (those deaths are already in the UN rates).
 */
import historyRaw from "@data/life/history.yaml";
import type { LifeRegion } from "@/game/engine/types";
import type { Faith, Place, SimEvent, SimState } from "@/game/sim/person";
import { roll } from "@/game/sim/pick";
import type { Rng } from "@/game/sim/rng";
import type { Sex } from "@/game/sim/tables";

export interface HistoryRow {
  id: string;
  from: number;
  to: number;
  regions?: LifeRegion[];
  places?: Place[];
  sex?: Sex;
  ages?: [number, number];
  chance?: number;
  faithChance?: Partial<Record<Faith, number>>;
  repeat?: boolean;
  effect?: { region?: LifeRegion; place?: Place };
  text: string;
  source: string;
  review?: boolean;
}

export const HISTORY: readonly HistoryRow[] = (historyRaw as { rows: HistoryRow[] }).rows;
const BY_ID = new Map(HISTORY.map((row) => [row.id, row]));
const DEFAULT_AGES: [number, number] = [5, 120];

export function historyRow(id: string): HistoryRow | undefined {
  return BY_ID.get(id);
}

/** True if this row can reach this person this year (before its chance is rolled). */
export function historyApplies(row: HistoryRow, state: SimState): boolean {
  const { person, year, age } = state;
  const [minAge, maxAge] = row.ages ?? DEFAULT_AGES;
  if (year < row.from || year > row.to || age < minAge || age > maxAge) return false;
  if (row.regions && !row.regions.includes(person.region)) return false;
  if (row.places && !row.places.includes(person.place)) return false;
  if (row.sex && row.sex !== person.sex) return false;
  if (!row.repeat && state.seen.includes(row.id)) return false;
  return true;
}

/** This year's history for someone living in Viet Nam. People abroad are past its reach. */
export function rollHistory(state: SimState, rng: Rng): SimEvent[] {
  if (state.ended || state.person.abroad) return [];
  const events: SimEvent[] = [];
  for (const row of HISTORY) {
    if (!historyApplies(row, state)) continue;
    const chance = row.faithChance?.[state.person.faith] ?? row.chance ?? 1;
    if (!roll(rng, chance)) continue;
    if (!row.repeat) state.seen.push(row.id);
    if (row.effect?.region) state.person.region = row.effect.region;
    if (row.effect?.place) state.person.place = row.effect.place;
    events.push({ type: "history", id: row.id });
  }
  return events;
}
