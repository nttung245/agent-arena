import type { LifeStepResult, LifeDecision } from "@/game/engine/types";
import type { LifeRun } from "@/game/state/lifeRun";

export const MAX_SCENES = 16;
export const REFLECTION_AGES = [5, 15, 30, 50, 70] as const;

export interface ChapterSpec {
  id: string;
  title: string;
  fromAge: number;
  toAge: number;
}

export const CHAPTERS: readonly ChapterSpec[] = [
  { id: "birth", title: "Birth", fromAge: 0, toAge: 0 },
  { id: "early_childhood", title: "Early childhood", fromAge: 1, toAge: 5 },
  { id: "school", title: "School", fromAge: 6, toAge: 11 },
  { id: "adolescence", title: "Adolescence", fromAge: 12, toAge: 18 },
  { id: "early_adulthood", title: "Early adulthood", fromAge: 19, toAge: 29 },
  { id: "midlife", title: "Midlife", fromAge: 30, toAge: 49 },
  { id: "late_life", title: "Late life", fromAge: 50, toAge: 69 },
  { id: "elder", title: "Elder", fromAge: 70, toAge: 200 },
];

const MAJOR_DECISION_NEEDLES = [
  "school",
  "educat",
  "exam",
  "univers",
  "job",
  "work",
  "career",
  "partner",
  "marri",
  "child",
  "pregnan",
  "migrat",
  "move",
  "abroad",
  "health",
  "illness",
  "sick",
  "hospital",
  "parent",
  "death",
  "care",
  "money",
  "debt",
];

export function chapterForAge(age: number): ChapterSpec {
  return (
    CHAPTERS.find((chapter) => age >= chapter.fromAge && age <= chapter.toAge) ??
    CHAPTERS[CHAPTERS.length - 1]!
  );
}

export function chapterIndexForAge(age: number): number {
  const index = CHAPTERS.findIndex(
    (chapter) => age >= chapter.fromAge && age <= chapter.toAge,
  );
  return index === -1 ? CHAPTERS.length - 1 : index;
}

export function isReflectionAge(age: number): boolean {
  return (REFLECTION_AGES as readonly number[]).includes(age);
}

export function isMajorDecision(
  decision: LifeDecision | null,
): boolean {
  if (!decision) return false;
  if (typeof decision.major === "boolean") return decision.major;
  const haystack =
    `${decision.about ?? ""} ${decision.question ?? ""}`.toLowerCase();
  return MAJOR_DECISION_NEEDLES.some((needle) => haystack.includes(needle));
}

export type SceneTriggerKind =
  | "birth"
  | "decision"
  | "event"
  | "reflection"
  | "death";

export interface SceneTrigger {
  kind: SceneTriggerKind;
  id: string;
  age: number;
  decision?: LifeDecision;
  eventText?: string;
}

export function selectTrigger(input: {
  run: LifeRun;
  previousAge: number;
  response: LifeStepResult;
  sceneCount: number;
  reflectedAges: ReadonlySet<number>;
}): SceneTrigger | null {
  const { run, previousAge, response, sceneCount, reflectedAges } = input;
  const age =
    typeof response.state?.age === "number" ? response.state.age : run.state.age;

  if (response.ended || run.ended) {
    return { kind: "death", id: `death:${age}`, age };
  }

  if (previousAge < 0 && age === 0) {
    return { kind: "birth", id: "birth:0", age };
  }

  if (sceneCount >= MAX_SCENES) return null;

  if (response.decision && isMajorDecision(response.decision)) {
    return {
      kind: "decision",
      id: response.decision.id,
      age,
      decision: response.decision,
    };
  }

  if (isReflectionAge(age) && !reflectedAges.has(age)) {
    return { kind: "reflection", id: `reflection:${age}`, age };
  }

  const chapter = chapterForAge(age);
  if (chapter.id !== chapterForAge(previousAge).id) {
    return {
      kind: "event",
      id: `chapter:${chapter.id}:${age}`,
      age,
      eventText: chapter.title,
    };
  }

  return null;
}

export function defaultChoiceKey(decision: LifeDecision): string {
  return decision.choices[0]?.key ?? "";
}
