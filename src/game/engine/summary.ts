import type { JournalEntry, LifeRun } from "@/game/state/lifeRun";

export interface JournalSections {
  birth: JournalEntry[];
  events: JournalEntry[];
  decisions: JournalEntry[];
  thoughts: JournalEntry[];
}

export function summarizeYears(
  run: LifeRun,
  fromAge: number,
  toAge: number,
): JournalEntry[] {
  return run.journal.filter(
    (entry) => entry.age >= fromAge && entry.age <= toAge,
  );
}

export function journalSections(run: LifeRun): JournalSections {
  return {
    birth: run.journal.filter(
      (entry) =>
        entry.kind === "birth" || (entry.kind === "event" && entry.age === 0),
    ),
    events: run.journal.filter(
      (entry) => entry.kind === "event" && entry.age !== 0,
    ),
    decisions: run.journal.filter((entry) => entry.kind === "decision"),
    thoughts: run.journal.filter((entry) => entry.kind === "thought"),
  };
}
