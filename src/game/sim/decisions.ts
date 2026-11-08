/**
 * Decisions the engine offers, as the game sees them. Text lives in
 * data/life/decisions.yaml; facts quote only sourced table values.
 */
import decisionsRaw from "@data/life/decisions.yaml";
import type { LifeDecision } from "@/game/engine/types";
import type { LifeTemplateId } from "@/game/scenes/types";
import { emigrantStock } from "@/game/sim/migration";
import type { SimState } from "@/game/sim/person";
import { nationalCompletion, tertiaryEnrolment } from "@/game/sim/school";
import { everMarried, totalFertilityRate, urbanShare } from "@/game/sim/tables";
import { fill } from "@/game/sim/text";
import { nationalSectorShare, retirementAge } from "@/game/sim/work";

export interface DecisionChoice {
  key: string;
  label: string;
  note?: string;
  share: number;
}

export interface DecisionDef {
  about: string;
  question: string;
  fact?: string;
  major: boolean;
  template: LifeTemplateId;
  choices: DecisionChoice[];
}

export const DECISIONS = decisionsRaw as Record<string, DecisionDef>;

export function decisionDef(id: string): DecisionDef {
  const def = DECISIONS[id];
  if (!def) throw new Error(`decisions.yaml has no decision "${id}"`);
  return def;
}

/** The choice that lets the data decide: the first one listed. */
export function naturalChoice(id: string): string {
  return decisionDef(id).choices[0].key;
}

const STOCK_YEARS = [1990, 1995, 2000, 2005, 2010, 2015, 2020, 2024];
const pct = (share: number) => Math.round(share * 100);

function formatAge(age: number): string {
  const years = Math.floor(age);
  const months = Math.round((age - years) * 12);
  return months === 0 ? String(years) : `${years} years and ${months} months`;
}

function formatPeople(n: number): string {
  return n >= 1e6 ? `${(n / 1e6).toFixed(1)} million` : `${Math.round(n / 1000)} thousand`;
}

/** Values the decision texts can use, from the tables and the decision's context. */
export function decisionValues(state: SimState, context: Readonly<Record<string, string | number>>): Record<string, string | number> {
  const { year, age, person } = state;
  const stockYear = [...STOCK_YEARS].reverse().find((y) => y <= year) ?? STOCK_YEARS[0];
  const capitalized = Object.fromEntries(
    Object.entries(context)
      .filter(([, v]) => typeof v === "string")
      .map(([k, v]) => [k[0].toUpperCase() + k.slice(1), String(v)[0].toUpperCase() + String(v).slice(1)]),
  );
  return {
    year,
    age,
    sexPlural: person.sex === "female" ? "women" : "men",
    lowerSecondaryPct: pct(nationalCompletion("lowerSecondary", year)),
    tertiaryPct: pct(tertiaryEnrolment(year)),
    farmingPct: pct(nationalSectorShare("agriculture", year)),
    marriedPct: pct(everMarried(person.sex, year, age)),
    tfr: totalFertilityRate(year).toFixed(1),
    urbanPct: pct(urbanShare(year)),
    stockYear,
    stock: formatPeople(emigrantStock(stockYear)),
    retirementAge: formatAge(retirementAge(person.sex, year)),
    ...context,
    ...capitalized,
  };
}

/** The waiting decision as the game shows it, or null. */
export function decisionView(state: SimState): LifeDecision | null {
  const pending = state.pending;
  if (!pending) return null;
  const def = decisionDef(pending.id);
  const values = decisionValues(state, pending.context);
  return {
    id: `${pending.id}@${state.year}`,
    question: fill(def.question, values),
    about: def.about,
    ...(def.fact ? { fact: fill(def.fact, values) } : {}),
    choices: def.choices.map((choice) => ({
      key: choice.key,
      label: fill(choice.label, values),
      ...(choice.note ? { note: fill(choice.note, values) } : {}),
    })),
    major: def.major,
    template: def.template,
  };
}
