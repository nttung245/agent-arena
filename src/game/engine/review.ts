import {
  completeRun,
  type JournalEntry,
  type LifeRun,
} from "@/game/state/lifeRun";

export interface LifeReview {
  name: string;
  bornYear?: number;
  diedYear?: number;
  ageAtDeath?: number;
  cause?: string;
  scenes: string[];
  keyEntries: JournalEntry[];
  thoughts: Array<{ age: number; text: string }>;
}

export function buildReview(
  run: LifeRun,
  sceneTitles: string[],
): LifeReview {
  const life = completeRun(run, sceneTitles);
  const deathAge = life.ageAtDeath;
  const deathEntries =
    deathAge != null
      ? run.journal.filter((entry) => entry.age === deathAge)
      : [];
  const otherEntries = run.journal.filter(
    (entry) => !deathEntries.includes(entry),
  );
  const keyEntries = [
    ...otherEntries.slice(0, 8),
    ...deathEntries,
  ];
  const thoughts = Object.entries(run.thoughts)
    .map(([age, text]) => ({ age: Number(age), text }))
    .sort((a, b) => a.age - b.age);

  return {
    name: life.name,
    bornYear: life.bornYear,
    diedYear: life.diedYear,
    ageAtDeath: life.ageAtDeath,
    cause: life.cause,
    scenes: life.sceneTitles,
    keyEntries,
    thoughts,
  };
}
