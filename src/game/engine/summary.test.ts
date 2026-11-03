import { describe, expect, it } from "vitest";
import { journalSections, summarizeYears } from "@/game/engine/summary";
import type { LifeRun } from "@/game/state/lifeRun";

const run = {
  journal: [
    { id: "1", age: 0, kind: "birth", text: "Born." },
    { id: "2", age: 6, kind: "event", text: "School." },
    { id: "3", age: 10, kind: "decision", text: "Choose.", choiceKey: "study" },
    { id: "4", age: 30, kind: "thought", text: "A thought." },
  ],
} as LifeRun;

describe("summarizeYears", () => {
  it("returns the entries inside the age range", () => {
    expect(summarizeYears(run, 6, 10).map((entry) => entry.id)).toEqual([
      "2",
      "3",
    ]);
  });
});

describe("journalSections", () => {
  it("groups entries by kind", () => {
    const sections = journalSections(run);
    expect(sections.birth.map((entry) => entry.id)).toEqual(["1"]);
    expect(sections.events.map((entry) => entry.id)).toEqual(["2"]);
    expect(sections.decisions.map((entry) => entry.id)).toEqual(["3"]);
    expect(sections.thoughts.map((entry) => entry.id)).toEqual(["4"]);
  });
});
