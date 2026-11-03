import { describe, expect, it } from "vitest";
import {
  CHAPTERS,
  MAX_SCENES,
  chapterForAge,
  defaultChoiceKey,
  isMajorDecision,
  isReflectionAge,
  selectTrigger,
} from "@/game/engine/chapters";
import type { LifeRun } from "@/game/state/lifeRun";
import type { LiveResponse, OneIn8bDecision } from "@/game/engine/types";

const decision = (about: string): OneIn8bDecision => ({
  id: `dec_${about}`,
  question: "What do you do?",
  about,
  choices: [
    { key: "a", label: "Study" },
    { key: "b", label: "Work" },
  ],
});

const runAt = (age: number): LifeRun => ({
  id: "r",
  startedAt: 0,
  engineVersion: "e",
  config: {},
  token: "t",
  state: { age },
  decision: null,
  focus: null,
  sheet: [],
  journal: [],
  thoughts: {},
  chapterIndex: 0,
  sceneCount: 0,
  ended: false,
  death: null,
  phase: "scene",
  meta: null,
  usage: null,
});

const response = (patch: Partial<LiveResponse>): LiveResponse => ({
  state: { age: 0 },
  events: [],
  decision: null,
  token: "t",
  ...patch,
});

describe("chapterForAge", () => {
  it("maps ages to the chapter table", () => {
    expect(chapterForAge(0).id).toBe("birth");
    expect(chapterForAge(3).id).toBe("early_childhood");
    expect(chapterForAge(8).id).toBe("school");
    expect(chapterForAge(16).id).toBe("adolescence");
    expect(chapterForAge(40).id).toBe("midlife");
    expect(chapterForAge(75).id).toBe("elder");
    expect(CHAPTERS.length).toBe(8);
  });
});

describe("isMajorDecision", () => {
  it("accepts the staged domains and rejects the rest", () => {
    for (const about of [
      "school",
      "work",
      "partner",
      "children",
      "migration",
      "health",
      "parent",
    ]) {
      expect(isMajorDecision(decision(about))).toBe(true);
    }
    expect(isMajorDecision(decision("weather"))).toBe(false);
    expect(isMajorDecision(null)).toBe(false);
  });
});

describe("isReflectionAge", () => {
  it("matches the five pause ages", () => {
    for (const age of [5, 15, 30, 50, 70]) {
      expect(isReflectionAge(age)).toBe(true);
    }
    expect(isReflectionAge(6)).toBe(false);
  });
});

describe("selectTrigger", () => {
  it("stages a major decision", () => {
    const trigger = selectTrigger({
      run: runAt(10),
      previousAge: 9,
      response: response({ state: { age: 10 }, decision: decision("school") }),
      sceneCount: 0,
      reflectedAges: new Set(),
    });
    expect(trigger).toMatchObject({ kind: "decision", age: 10 });
  });

  it("does not stage a minor decision", () => {
    const trigger = selectTrigger({
      run: runAt(10),
      previousAge: 9,
      response: response({ state: { age: 10 }, decision: decision("weather") }),
      sceneCount: 0,
      reflectedAges: new Set(),
    });
    expect(trigger).toBeNull();
  });

  it("stages birth on the start response", () => {
    const trigger = selectTrigger({
      run: runAt(0),
      previousAge: -1,
      response: response({ state: { age: 0 } }),
      sceneCount: 0,
      reflectedAges: new Set(),
    });
    expect(trigger).toMatchObject({ kind: "birth", age: 0 });
  });

  it("stages a chapter boundary as an event", () => {
    const trigger = selectTrigger({
      run: runAt(6),
      previousAge: 5,
      response: response({ state: { age: 6 } }),
      sceneCount: 0,
      reflectedAges: new Set(),
    });
    expect(trigger).toMatchObject({ kind: "event", age: 6 });
  });

  it("stages a reflection once", () => {
    const trigger = selectTrigger({
      run: runAt(5),
      previousAge: 4,
      response: response({ state: { age: 5 } }),
      sceneCount: 0,
      reflectedAges: new Set(),
    });
    expect(trigger).toMatchObject({ kind: "reflection", age: 5 });
    const again = selectTrigger({
      run: runAt(5),
      previousAge: 4,
      response: response({ state: { age: 5 } }),
      sceneCount: 0,
      reflectedAges: new Set([5]),
    });
    expect(again).toBeNull();
  });

  it("always stages death, even after the scene cap", () => {
    const trigger = selectTrigger({
      run: runAt(80),
      previousAge: 79,
      response: response({
        state: { age: 80 },
        ended: true,
        death: { age: 80 },
      }),
      sceneCount: MAX_SCENES,
      reflectedAges: new Set(),
    });
    expect(trigger).toMatchObject({ kind: "death", age: 80 });
  });

  it("stops new scenes at the cap", () => {
    const trigger = selectTrigger({
      run: runAt(40),
      previousAge: 39,
      response: response({ state: { age: 40 }, decision: decision("work") }),
      sceneCount: MAX_SCENES,
      reflectedAges: new Set(),
    });
    expect(trigger).toBeNull();
  });
});

describe("defaultChoiceKey", () => {
  it("returns the first choice key", () => {
    expect(defaultChoiceKey(decision("work"))).toBe("a");
  });
});
