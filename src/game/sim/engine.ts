/**
 * The local life engine: start, step and view, in the shape the game expects
 * (LifeStepResult). A year runs in phases; a phase can pause the year for a
 * decision, and the year carries on from the next phase once the player
 * chooses. Each decision's first choice lets the data decide, so a life left
 * to its defaults stays calibrated.
 */
import catalogRaw from "@data/life/catalog.yaml";
import {
  LifeEngineError,
  type LifeEvent,
  type LifeFocus,
  type LifeSheetItem,
  type LifeStepResult,
  type StartOptions,
  type StepBody,
} from "@/game/engine/types";
import { drawBirth } from "@/game/sim/birth";
import { causeLabel } from "@/game/sim/causes";
import { decisionDef, decisionView, naturalChoice } from "@/game/sim/decisions";
import { addPartner, proposePartner, rollFamilyLife } from "@/game/sim/family";
import { rollHistory } from "@/game/sim/history";
import { rollIllness, treatIllness } from "@/game/sim/illness";
import { moveOpportunity, takeMove } from "@/game/sim/migration";
import { rollPersonDeath, rollRelativeDeaths } from "@/game/sim/mortality";
import { STAT_KEYS, type Sector, type SimEvent, type SimState, type Stats } from "@/game/sim/person";
import { roll } from "@/game/sim/pick";
import { createRng, restoreRng, type Rng } from "@/game/sim/rng";
import { leaveSchool, rollSchool, stageEndsThisYear } from "@/game/sim/school";
import type { Sex } from "@/game/sim/tables";
import { birthText, eventText, lifeStateView } from "@/game/sim/text";
import { decodeToken, encodeToken } from "@/game/sim/token";
import { retiresThisYear, rollWork, startsWorkThisYear } from "@/game/sim/work";

export const ENGINE_VERSION = "arena-life@0.1.0";
export const DATA_CREDIT =
  "Population data: UN DESA, World Population Prospects 2024, World Marriage Data 2019 and International Migrant Stock 2024 (CC BY 3.0 IGO); World Bank, World Development Indicators (CC BY 4.0); UNESCO Institute for Statistics (CC BY-SA 4.0).";
const MAX_YEARS_PER_STEP = 25;
/** With no decision waiting, a step still stops at ages that are a multiple of this. */
const MILESTONE_EVERY = 5;

type StatEffects = Partial<Record<keyof Stats, number>>;

interface Catalog {
  focus: {
    default: string;
    options: Record<string, StatEffects & { label: string; studyYear?: boolean; careerBonus?: number }>;
  };
  drift: {
    schoolKnowledge: number;
    workKnowledge: number;
    savingsRate: number;
    treatmentCostYears: number;
    careerBonusMax: number;
  };
  sheet: Record<
    string,
    StatEffects & {
      name: string;
      does: string;
      price: number;
      when: "studying" | "notInsured" | "adultWithoutMotorbike" | "parentAlive";
      studyYear?: boolean;
      insured?: boolean;
      motorbike?: boolean;
    }
  >;
}

const CATALOG = catalogRaw as Catalog;

interface Raise {
  id: string;
  context: Record<string, string | number>;
}
interface PhaseResult {
  events: SimEvent[];
  decision?: Raise;
}
type Phase = (state: SimState, rng: Rng) => PhaseResult;

function clampStat(value: number): number {
  return Math.min(100, Math.max(0, Math.round(value)));
}

function addStats(state: SimState, effects: StatEffects): void {
  for (const key of STAT_KEYS) {
    if (effects[key]) state.stats[key] = clampStat(state.stats[key] + effects[key]!);
  }
}

function treatmentCost(state: SimState): number {
  return Math.round(Math.max(state.work.income, 1000) * CATALOG.drift.treatmentCostYears);
}

function aliveParent(state: SimState, minAge: number) {
  return state.relatives.find(
    (r) => (r.role === "mother" || r.role === "father") && r.alive && state.year - r.birthYear >= minAge,
  );
}

function childCount(state: SimState): number {
  return state.relatives.filter((r) => r.role === "child").length;
}

function womanAge(state: SimState): number | null {
  if (state.person.sex === "female") return state.age;
  const partner = state.relatives.find((r) => r.id === state.partnerId);
  return partner ? state.year - partner.birthYear : null;
}

const PHASES: Phase[] = [
  // History of the year.
  (s, rng) => ({ events: rollHistory(s, rng) }),
  // Relatives' deaths.
  (s, rng) => ({ events: rollRelativeDeaths(s, rng) }),
  // Illness; a new diagnosis raises a treatment decision.
  (s, rng) => {
    const events = rollIllness(s, rng);
    const diagnosed = events.find((e) => e.type === "diagnosed");
    if (!diagnosed || s.ended || diagnosed.type !== "diagnosed") return { events };
    return {
      events,
      decision: {
        id: "treatment",
        context: { causeId: diagnosed.cause, cause: causeLabel(diagnosed.cause, s.year), cost: treatmentCost(s) },
      },
    };
  },
  // Sudden death.
  (s, rng) => ({ events: !s.ended && rollPersonDeath(s, rng) ? [{ type: "died", cause: s.death!.cause }] : [] }),
  // School; the end of lower and upper secondary raise decisions.
  (s, rng) => {
    if (stageEndsThisYear(s) && s.education.studying === "lowerSecondary") return { events: [], decision: { id: "school_upper", context: {} } };
    if (stageEndsThisYear(s) && s.education.studying === "upperSecondary") return { events: [], decision: { id: "university", context: {} } };
    return { events: rollSchool(s, rng) };
  },
  // Work; a first job and retirement raise decisions.
  (s, rng) => {
    if (startsWorkThisYear(s)) return { events: [], decision: { id: "first_job", context: {} } };
    if (retiresThisYear(s)) return { events: [], decision: { id: "retire", context: {} } };
    return { events: rollWork(s, rng) };
  },
  // Family; a proposal or a second child raises a decision.
  (s, rng) => {
    const hadPartner = s.partnerId !== null;
    const events = rollFamilyLife(s, rng);
    if (!hadPartner && s.partnerId === null && !s.ended) {
      const draft = proposePartner(s, rng);
      if (draft) {
        return {
          events,
          decision: {
            id: "marriage",
            context: {
              partner: draft.name,
              partnerSex: draft.sex,
              partnerBirthYear: draft.birthYear,
              partnerFamilyName: draft.familyName,
              partnerGivenName: draft.givenName,
            },
          },
        };
      }
    }
    const age = womanAge(s);
    if (s.partnerId !== null && childCount(s) >= 2 && age !== null && age <= 45 && !s.flags.decided.includes("family_size")) {
      return { events, decision: { id: "family_size", context: { children: childCount(s) } } };
    }
    return { events };
  },
  // Moves; a chance to move raises a decision.
  (s, rng) => {
    const move = moveOpportunity(s, rng);
    if (!move) return { events: [] };
    return move.kind === "emigrate"
      ? { events: [], decision: { id: "emigrate", context: { destination: move.destination } } }
      : { events: [], decision: { id: "move_city", context: {} } };
  },
  // Occasional decisions: an old parent, a business offer.
  (s, rng) => {
    const parent = aliveParent(s, 72);
    if (parent && s.age >= 25 && s.age <= 65 && !s.person.abroad && !s.flags.decided.includes("care_parent") && roll(rng, 0.3)) {
      const mother = parent.role === "mother";
      return {
        events: [],
        decision: {
          id: "care_parent",
          context: { parentRole: parent.role, pronoun: mother ? "she" : "he", possessive: mother ? "her" : "his" },
        },
      };
    }
    const offerDue = s.flags.lastOffer === undefined || s.year - s.flags.lastOffer >= 10;
    if (s.age >= 28 && s.age <= 55 && s.money > 0 && offerDue && roll(rng, 0.04)) {
      return { events: [], decision: { id: "business", context: {} } };
    }
    return { events: [] };
  },
  // The year ends: focus, savings, and the next birthday.
  (s) => {
    endYear(s);
    return { events: [] };
  },
];

function endYear(state: SimState): void {
  const { drift, focus } = CATALOG;
  const option = focus.options[state.focus] ?? focus.options[focus.default];
  addStats(state, option);
  if (state.education.studying !== null) {
    addStats(state, { knowledge: drift.schoolKnowledge });
    if (option.studyYear) state.flags.studyYears++;
  }
  if (state.work.status === "working") {
    addStats(state, { knowledge: drift.workKnowledge });
    if (option.careerBonus) state.flags.careerBonus = Math.min(state.flags.careerBonus + option.careerBonus, drift.careerBonusMax);
  }
  if (state.work.status !== "notYet") state.money += state.work.income * drift.savingsRate;
  state.age++;
  state.year++;
}

/** Applies the player's answer to the waiting decision. */
function resolve(state: SimState, rng: Rng, choice: string): SimEvent[] {
  const pending = state.pending!;
  const def = decisionDef(pending.id);
  if (!def.choices.some((c) => c.key === choice)) {
    throw new LifeEngineError(`"${choice}" is not a choice for this decision.`, "invalid_choice", 400);
  }
  state.pending = null;
  const ctx = pending.context;
  switch (pending.id) {
    case "school_upper":
      if (choice === "leave") return [leaveSchool(state)];
      return rollSchool(state, rng, choice === "study_hard" ? { finishOdds: 2.5 } : {});
    case "university":
      return rollSchool(
        state,
        rng,
        choice === "study_hard" ? { finishOdds: 1.5, entryOdds: 2 } : choice === "work" ? { noUniversity: true } : {},
      );
    case "first_job":
      return rollWork(state, rng, choice === "any" ? {} : { sector: choice as Sector });
    case "retire":
      if (choice === "keep_working") state.flags.workUntil = state.age + 3;
      return rollWork(state, rng);
    case "marriage":
      if (choice !== "marry") return [];
      return [
        addPartner(state, {
          name: String(ctx.partner),
          sex: ctx.partnerSex as Sex,
          birthYear: Number(ctx.partnerBirthYear),
          familyName: String(ctx.partnerFamilyName),
          givenName: String(ctx.partnerGivenName),
        }),
      ];
    case "family_size":
      state.flags.decided.push("family_size");
      if (choice === "stop") state.flags.noMoreChildren = true;
      return [];
    case "treatment":
      if (choice === "city") {
        treatIllness(state, String(ctx.causeId));
        if (!state.flags.insured) state.money -= Number(ctx.cost);
      }
      return [];
    case "move_city":
      return choice === "go" ? [takeMove(state, { kind: "town" })] : [];
    case "emigrate":
      return choice === "go" ? [takeMove(state, { kind: "emigrate", destination: String(ctx.destination) })] : [];
    case "care_parent":
      state.flags.decided.push("care_parent");
      if (choice === "live_together") addStats(state, { bonds: 8, happiness: -2 });
      return [];
    case "business": {
      state.flags.lastOffer = state.year;
      if (choice !== "invest") return [];
      const stake = Math.max(0, state.money * 0.5);
      state.money += roll(rng, 0.5) ? stake * 0.6 : -stake * 0.6;
      return [];
    }
    default:
      return [];
  }
}

type Until = NonNullable<StepBody["until"]>;

/** Runs phases until a decision waits, the life ends, or `until` says to stop. */
function run(state: SimState, rng: Rng, out: LifeEvent[], until: Until): void {
  let years = 0;
  for (;;) {
    if (state.ended) return;
    if (state.pending) {
      if (typeof until !== "number") return;
      const age = state.age;
      for (const e of resolve(state, rng, naturalChoice(state.pending.id))) out.push([age, eventText(state, e)]);
      continue;
    }
    const age = state.age;
    const result = PHASES[state.phase](state, rng);
    for (const e of result.events) out.push([age, eventText(state, e)]);
    state.phase++;
    if (result.decision && !state.ended) {
      state.pending = { id: result.decision.id, phase: state.phase - 1, context: result.decision.context };
      continue;
    }
    if (state.phase < PHASES.length) continue;
    state.phase = 0;
    years++;
    if (years >= MAX_YEARS_PER_STEP) return;
    if (until === "year") return;
    if (typeof until === "number" ? state.age >= until : state.age % MILESTONE_EVERY === 0) return;
  }
}

function eligible(state: SimState, when: Catalog["sheet"][string]["when"]): boolean {
  switch (when) {
    case "studying":
      return state.education.studying !== null;
    case "notInsured":
      return !state.flags.insured;
    case "adultWithoutMotorbike":
      return state.age >= 18 && !state.flags.motorbike;
    case "parentAlive":
      return state.age >= 20 && !!aliveParent(state, 0);
  }
}

function sheetView(state: SimState): LifeSheetItem[] {
  if (state.ended) return [];
  return Object.entries(CATALOG.sheet)
    .filter(([, item]) => eligible(state, item.when))
    .map(([id, item]) => {
      const can = state.money >= item.price;
      return {
        id,
        name: item.name,
        does: item.does,
        price_ppp: item.price,
        can,
        ...(can ? {} : { why: "Not enough savings" }),
      };
    });
}

function buy(state: SimState, id: string): SimEvent | null {
  const item = CATALOG.sheet[id];
  if (!item || !eligible(state, item.when) || state.money < item.price) return null;
  state.money -= item.price;
  if (item.studyYear) state.flags.studyYears++;
  if (item.insured) state.flags.insured = true;
  if (item.motorbike) state.flags.motorbike = true;
  addStats(state, item);
  return { type: "bought", item: item.name };
}

function focusView(state: SimState): LifeFocus {
  return {
    now: state.focus,
    options: Object.entries(CATALOG.focus.options).map(([key, option]) => ({ key, label: option.label })),
  };
}

function result(state: SimState, events: LifeEvent[]): LifeStepResult {
  const deathLabel = state.death ? causeLabel(state.death.cause, state.death.year) : undefined;
  return {
    state: lifeStateView(state),
    events,
    decision: decisionView(state),
    focus: focusView(state),
    sheet: sheetView(state),
    ended: state.ended,
    death: state.death ? { age: state.death.age, cause: deathLabel, cause_of_death: deathLabel } : null,
    token: encodeToken(state),
    meta: {
      kind: "life",
      engine: ENGINE_VERSION,
      simulated: "Simulated life, not a real person.",
      credit: DATA_CREDIT,
    },
  };
}

export function startLife(options: StartOptions & { seed: number }): LifeStepResult {
  const rng = createRng(options.seed);
  const state = drawBirth(
    {
      seed: options.seed,
      year: options.future ? undefined : options.year,
      sex: options.sex,
      region: options.region,
      place: options.place,
      fifth: options.fifth,
      faith: options.faith,
    },
    rng,
  );
  state.rng = rng.state();
  return result(state, [[0, birthText(state)]]);
}

export function stepLife(body: StepBody): LifeStepResult {
  const state = decodeToken(body.token);
  if (body.view || state.ended) return result(state, []);
  const rng = restoreRng(state.rng);
  const out: LifeEvent[] = [];
  if (body.focus !== undefined) {
    if (!(body.focus in CATALOG.focus.options)) {
      throw new LifeEngineError(`"${body.focus}" is not a focus.`, "invalid_focus", 400);
    }
    state.focus = body.focus;
  }
  for (const id of body.buy ?? []) {
    const bought = buy(state, id);
    if (bought) out.push([state.age, eventText(state, bought)]);
  }
  if (body.choose !== undefined) {
    if (!state.pending) throw new LifeEngineError("There is no decision waiting.", "invalid_choice", 400);
    const age = state.age;
    for (const e of resolve(state, rng, body.choose)) out.push([age, eventText(state, e)]);
  } else if (state.pending) {
    state.rng = rng.state();
    return result(state, out);
  }
  run(state, rng, out, body.until ?? "decision");
  state.rng = rng.state();
  return result(state, out);
}
