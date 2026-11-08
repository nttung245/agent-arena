/**
 * Words for the simulated life: journal lines for events, and the state the
 * game's screens read (people as { name, age, alive, job }, places and fifths
 * as labels). Templates live in data/life/events.yaml.
 */
import eventsRaw from "@data/life/events.yaml";
import type { LifeState } from "@/game/engine/types";
import { causeLabel } from "@/game/sim/causes";
import { historyRow } from "@/game/sim/history";
import type { Relative, SchoolStage, SimEvent, SimState } from "@/game/sim/person";

type Gendered = { female: string; male: string };
interface EventTemplates extends Record<string, unknown> {
  stages: Record<SchoolStage, string>;
  relations: { mother: string; father: string; sibling: Gendered; partner: Gendered; child: Gendered };
}

const TEXT = eventsRaw as EventTemplates;

/** Fills {key} placeholders; unknown keys are left as they are. */
export function fill(template: string, values: Readonly<Record<string, string | number>>): string {
  return template.replace(/\{(\w+)\}/g, (match, key: string) => (key in values ? String(values[key]) : match));
}

function template(key: string): string {
  const value = TEXT[key];
  if (typeof value !== "string") throw new Error(`events.yaml has no line for "${key}"`);
  return value;
}

const REGION_LABEL = { north: "North", central: "Central region", south: "South" } as const;
const FIFTH_LABEL = ["", "the poorest fifth", "the second fifth", "the middle fifth", "the fourth fifth", "the richest fifth"];
const FAITH_LABEL: Record<string, string> = {
  none: "no registered religion",
  buddhist: "Buddhist",
  catholic: "Catholic",
  protestant: "Protestant",
  hoaHao: "Hòa Hảo",
  caoDai: "Cao Đài",
  other: "another faith",
};

export function stageLabel(stage: SchoolStage): string {
  return TEXT.stages[stage];
}

export function relationLabel(relative: Relative): string {
  const relation = TEXT.relations[relative.role];
  return typeof relation === "string" ? relation : relation[relative.sex];
}

function relativeById(state: SimState, id: string): Relative | undefined {
  return state.relatives.find((r) => r.id === id);
}

/** The journal line for one event, or null if it has no words (should not happen). */
export function eventText(state: SimState, event: SimEvent): string {
  switch (event.type) {
    case "history":
      return historyRow(event.id)?.text ?? "";
    case "diagnosed":
    case "worsened":
    case "recovered":
    case "died":
      return fill(template(event.type), { cause: causeLabel(event.cause, state.death?.year ?? state.year) });
    case "relativeDied": {
      const relative = relativeById(state, event.relativeId);
      return fill(template("relativeDied"), {
        relation: relative ? relationLabel(relative) : "A relative",
        relative: relative?.givenName ?? "",
        cause: causeLabel(event.cause, relative?.diedYear ?? state.year),
      });
    }
    case "widowed":
    case "partnered":
    case "divorced":
      return fill(template(event.type), { relative: relativeById(state, event.relativeId)?.name ?? "" });
    case "childBorn":
    case "siblingBorn": {
      const relative = relativeById(state, event.relativeId);
      const female = relative?.sex === "female";
      return fill(template(event.type), {
        relative: relative?.givenName ?? "",
        child: female ? "daughter" : "son",
        sibling: female ? "sister" : "brother",
      });
    }
    case "schoolStarted":
    case "retired":
      return template(event.type);
    case "schoolFinished":
      return fill(template("schoolFinished"), { stage: stageLabel(event.stage) });
    case "schoolLeft":
      return event.stage === "none"
        ? template("schoolLeftNone")
        : fill(template("schoolLeft"), { stage: stageLabel(event.stage) });
    case "startedWork":
    case "changedJob":
      return fill(template(event.type), { job: event.job });
    case "moved":
      return template("moved");
    case "emigrated":
      return fill(template("emigrated"), { destination: event.destination });
    case "chose":
      return fill(template("chose"), { choice: event.choice });
    case "bought":
      return fill(template("bought"), { item: event.item });
  }
}

export function birthText(state: SimState): string {
  const { person } = state;
  return fill(template("born"), {
    place: person.birthPlace === "town" ? "a town" : "a village",
    region: REGION_LABEL[person.region],
    year: person.birthYear,
  });
}

function personView(relative: Relative | undefined, year: number) {
  if (!relative) return null;
  const age = (relative.alive ? year : relative.diedYear!) - relative.birthYear;
  return { name: relative.name, age, alive: relative.alive, sex: relative.sex };
}

/** The life as the game's screens and scene director read it. */
export function lifeStateView(state: SimState): LifeState {
  const { person, relatives, year } = state;
  const of = (role: Relative["role"]) => relatives.filter((r) => r.role === role).map((r) => personView(r, year));
  const partner = relatives.find((r) => r.id === state.partnerId);
  return {
    name: person.name,
    age: state.age,
    year,
    country: "VNM",
    region: person.region,
    place: `${person.place === "town" ? "a town" : "a village"} in the ${REGION_LABEL[person.region]}`,
    sex: person.sex,
    faith: FAITH_LABEL[person.faith],
    fifth: FIFTH_LABEL[person.fifth],
    job: state.work.status === "working" ? state.work.job ?? null : state.work.status === "retired" ? "retired" : null,
    income: state.work.income,
    net_worth: Math.round(state.money),
    health: state.stats.health,
    happiness: state.stats.happiness,
    knowledge: state.stats.knowledge,
    bonds: state.stats.bonds,
    education: stageLabel(state.education.completed),
    mother: personView(relatives.find((r) => r.role === "mother"), year),
    father: personView(relatives.find((r) => r.role === "father"), year),
    siblings: of("sibling"),
    partner: personView(partner, year),
    kids: of("child"),
    abroad: person.abroad ?? null,
  };
}
