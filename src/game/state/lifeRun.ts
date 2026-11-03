import { uid } from "@/lib/storage";
import type {
  LiveResponse,
  OneIn8bDeath,
  OneIn8bDecision,
  OneIn8bFocus,
  OneIn8bMeta,
  OneIn8bSheetItem,
  OneIn8bState,
  OneIn8bUsage,
} from "@/game/engine/types";

export type LifePhase =
  | "setup"
  | "birth"
  | "scene"
  | "summary"
  | "reflection"
  | "death"
  | "review"
  | "memorial";

export interface LifeConfig {
  year?: number;
  future?: boolean;
  sex?: "female" | "male" | "random";
  fifth?: string;
  place?: "town" | "village";
  faith?: string;
  disability?: string;
  seed?: number;
}

export interface JournalEntry {
  id: string;
  age: number;
  year?: number;
  text: string;
  source?: string;
  kind: "event" | "decision" | "summary" | "thought" | "birth";
  choiceKey?: string;
}

export interface LifeRun {
  id: string;
  startedAt: number;
  engineVersion: string;
  config: LifeConfig;
  token: string;
  state: OneIn8bState;
  decision: OneIn8bDecision | null;
  focus: OneIn8bFocus | null;
  sheet: OneIn8bSheetItem[];
  journal: JournalEntry[];
  thoughts: Record<number, string>;
  chapterIndex: number;
  sceneCount: number;
  ended: boolean;
  death: OneIn8bDeath | null;
  phase: LifePhase;
  meta: OneIn8bMeta | null;
  usage: OneIn8bUsage | null;
}

export interface CompletedLife {
  id: string;
  name: string;
  country: string;
  bornYear?: number;
  diedYear?: number;
  ageAtDeath?: number;
  cause?: string;
  journal: JournalEntry[];
  thoughts: Record<number, string>;
  sceneTitles: string[];
  completedAt: number;
  engineVersion: string;
}

export function journalFromResponse(
  res: LiveResponse,
  kind: JournalEntry["kind"],
  year?: number,
): JournalEntry[] {
  return res.events
    .map((event): JournalEntry => {
      const age = typeof event[0] === "number" ? event[0] : 0;
      const text = typeof event[1] === "string" ? event[1] : "";
      const source = typeof event[2] === "string" ? event[2] : undefined;
      return {
        id: uid("j"),
        age,
        year,
        text,
        source,
        kind,
      };
    })
    .filter((entry) => entry.text.trim().length > 0);
}

export function createRun(config: LifeConfig, res: LiveResponse): LifeRun {
  return {
    id: uid("life"),
    startedAt: Date.now(),
    engineVersion: res.meta?.engine ?? "unknown",
    config,
    token: res.token ?? "",
    state: res.state,
    decision: res.decision ?? null,
    focus: res.focus ?? null,
    sheet: res.sheet ?? [],
    journal: journalFromResponse(res, "birth", res.state.year),
    thoughts: {},
    chapterIndex: 0,
    sceneCount: 0,
    ended: Boolean(res.ended),
    death: res.death ?? null,
    phase: res.ended ? "death" : "birth",
    meta: res.meta ?? null,
    usage: res.usage ?? null,
  };
}

export function applyLiveResponse(run: LifeRun, res: LiveResponse): LifeRun {
  const events = journalFromResponse(res, "event", res.state.year);
  const decisionEntries: JournalEntry[] = res.decision
    ? [
        {
          id: uid("j"),
          age: res.state.age,
          year: res.state.year,
          text: res.decision.question,
          kind: "decision",
        },
      ]
    : [];

  return {
    ...run,
    token: res.token ?? run.token,
    state: res.state,
    decision: res.decision ?? null,
    focus: res.focus ?? run.focus,
    sheet: res.sheet ?? run.sheet,
    journal: [...run.journal, ...events, ...decisionEntries],
    ended: Boolean(res.ended ?? run.ended),
    death: res.death ?? run.death,
    phase: res.ended ? "death" : run.phase,
    meta: res.meta ?? run.meta,
    usage: res.usage ?? run.usage,
  };
}

export function addThought(run: LifeRun, age: number, thought: string): LifeRun {
  const text = thought.trim();
  if (!text) return run;
  return {
    ...run,
    thoughts: { ...run.thoughts, [age]: text },
    journal: [
      ...run.journal,
      {
        id: uid("j"),
        age,
        year: run.state.year,
        text,
        kind: "thought",
      },
    ],
  };
}

export function completeRun(
  run: LifeRun,
  sceneTitles: string[],
): CompletedLife {
  const stateYear = typeof run.state.year === "number" ? run.state.year : undefined;
  const bornYear =
    typeof run.config.year === "number"
      ? run.config.year
      : stateYear != null && typeof run.state.age === "number"
        ? stateYear - run.state.age
        : undefined;
  const cause = run.death?.cause ?? run.death?.cause_of_death;
  return {
    id: run.id,
    name:
      typeof run.state.name === "string" && run.state.name.trim()
        ? run.state.name
        : "You",
    country:
      typeof run.state.country === "string" && run.state.country
        ? run.state.country
        : "VNM",
    bornYear,
    diedYear: stateYear,
    ageAtDeath: run.death?.age ?? run.state.age,
    cause: typeof cause === "string" ? cause : undefined,
    journal: run.journal,
    thoughts: run.thoughts,
    sceneTitles,
    completedAt: Date.now(),
    engineVersion: run.engineVersion,
  };
}
