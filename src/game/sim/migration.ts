/**
 * Moves: village to town as Viet Nam urbanizes, and emigration at the rate the
 * UN migrant stock implies. See effects.yaml `migration`.
 */
import migrationData from "@data/life/vnm/migration.json";
import birthRaw from "@data/life/birth.yaml";
import type { LifeRegion } from "@/game/engine/types";
import { EFFECTS } from "@/game/sim/causes";
import type { SimEvent, SimState } from "@/game/sim/person";
import { meanOne, roll, weightedPick } from "@/game/sim/pick";
import type { Rng } from "@/game/sim/rng";
import { population, urbanShare } from "@/game/sim/tables";

const MIGRATION = EFFECTS.migration;
const STOCK = migrationData.emigrantStock as { years: number[]; destinations: Record<string, number[]> };
const REGION_SHARES = (birthRaw as { regions: { shares: Record<LifeRegion, number> } }).regions.shares;

const STOCK_TOTALS = STOCK.years.map((_, i) =>
  Object.values(STOCK.destinations).reduce((sum, counts) => sum + counts[i], 0),
);

/** Total people born in Viet Nam living abroad, interpolated between the UN's stock years. */
export function emigrantStock(year: number): number {
  const totals = STOCK_TOTALS;
  const years = STOCK.years;
  if (year <= years[0]) return totals[0];
  if (year >= years[years.length - 1]) return totals[totals.length - 1];
  const i = years.findIndex((y) => y >= year);
  const [y0, y1] = [years[i - 1], years[i]];
  return totals[i - 1] + ((totals[i] - totals[i - 1]) * (year - y0)) / (y1 - y0);
}

const EARLY = MIGRATION.emigration.early;
const EARLY_WEIGHT_TOTAL = (() => {
  let total = 0;
  for (let y = EARLY.from; y <= EARLY.to; y++) total += EARLY.weights[String(y)] ?? 1;
  return total;
})();
const EARLY_REGION = meanOne(EARLY.regions as Record<LifeRegion, number>, REGION_SHARES);

/** People leaving Viet Nam in a year (before 1975: none). */
export function emigrantOutflow(year: number): number {
  const y = Math.round(year);
  if (y < EARLY.from) return 0;
  if (y <= EARLY.to) {
    return (emigrantStock(STOCK.years[0]) * EARLY.ofStock1990 * (EARLY.weights[String(y)] ?? 1)) / EARLY_WEIGHT_TOTAL;
  }
  const growth = Math.max(0, emigrantStock(y + 1) - emigrantStock(y));
  return growth + emigrantStock(y) * MIGRATION.emigration.stockTurnover;
}

/** Yearly chance that an eligible adult in this region emigrates. */
export function emigrationChance(year: number, region: LifeRegion): number {
  const adults = population(year) * 1000 * MIGRATION.emigration.adultShare;
  const regionWeight = year <= EARLY.to ? EARLY_REGION[region] : 1;
  return Math.min((emigrantOutflow(year) / adults) * regionWeight, 0.2);
}

/** The destination for someone leaving in `year`, by where Viet Nam's emigrants lived then (1990 before 1990). */
export function pickDestination(year: number, rng: Rng): string {
  let index = 0;
  STOCK.years.forEach((stockYear, i) => {
    if (stockYear <= year) index = i;
  });
  return weightedPick(
    rng,
    Object.entries(STOCK.destinations)
      .filter(([name]) => name !== "Other")
      .map(([name, counts]) => ({ key: name, weight: counts[index] })),
  );
}

/** Yearly chance that a young villager moves to a town, from the yearly rise in the urban share. */
export function townMoveChance(year: number): number {
  const now = urbanShare(year);
  const rise = Math.max(0, urbanShare(year + 1) - now);
  return Math.min(rise / ((1 - now) * MIGRATION.townMove.shareOfRural), 0.2);
}

export function emigrate(state: SimState, destination: string): SimEvent {
  state.person.abroad = destination;
  return { type: "emigrated", destination };
}

export type MoveOpportunity = { kind: "emigrate"; destination: string } | { kind: "town" };

/** Rolls whether a chance to move comes this year, before the person decides. */
export function moveOpportunity(state: SimState, rng: Rng): MoveOpportunity | null {
  if (state.ended || state.person.abroad) return null;
  const { age, year, person } = state;
  const { emigration, townMove } = MIGRATION;
  if (age >= emigration.minAge && age <= emigration.maxAge && roll(rng, emigrationChance(year, person.region))) {
    return { kind: "emigrate", destination: pickDestination(year, rng) };
  }
  if (person.place === "village" && age >= townMove.minAge && age <= townMove.maxAge && roll(rng, townMoveChance(year))) {
    return { kind: "town" };
  }
  return null;
}

/** The person takes the move. */
export function takeMove(state: SimState, move: MoveOpportunity): SimEvent {
  if (move.kind === "emigrate") return emigrate(state, move.destination);
  state.person.place = "town";
  return { type: "moved", place: "town" };
}

/** One year of moves, taking any that comes. */
export function rollMigration(state: SimState, rng: Rng): SimEvent[] {
  const move = moveOpportunity(state, rng);
  return move ? [takeMove(state, move)] : [];
}
