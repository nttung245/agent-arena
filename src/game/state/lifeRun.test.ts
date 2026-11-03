import { describe, expect, it } from "vitest";
import {
  addThought,
  applyLiveResponse,
  completeRun,
  createRun,
  journalFromResponse,
} from "@/game/state/lifeRun";
import type { LiveResponse } from "@/game/engine/types";

const start: LiveResponse = {
  state: { age: 0, name: "Lan", year: 1995, country: "VNM" },
  events: [[0, "You were born in a village in Vietnam."]],
  decision: null,
  token: "tok_1",
  ended: false,
  meta: { engine: "0.9.22" },
};

describe("createRun", () => {
  it("starts at birth and keeps the first record", () => {
    const run = createRun({ year: 1995 }, start);
    expect(run.phase).toBe("birth");
    expect(run.token).toBe("tok_1");
    expect(run.engineVersion).toBe("0.9.22");
    expect(run.journal[0]).toMatchObject({
      age: 0,
      text: "You were born in a village in Vietnam.",
      kind: "birth",
    });
  });
});

describe("applyLiveResponse", () => {
  it("appends events with their source, updates the token, and ends", () => {
    const run = createRun({}, start);
    const next = applyLiveResponse(run, {
      state: { age: 80, name: "Lan" },
      events: [[80, "You died at home.", "A source note"]],
      decision: null,
      token: "tok_2",
      ended: true,
      death: { age: 80, cause: "old age" },
    });
    expect(next.token).toBe("tok_2");
    expect(next.journal.at(-1)).toMatchObject({
      age: 80,
      source: "A source note",
      kind: "event",
    });
    expect(next.ended).toBe(true);
    expect(next.phase).toBe("death");
    expect(next.death?.cause).toBe("old age");
  });

  it("tolerates a missing token by keeping the previous one", () => {
    const run = createRun({}, start);
    const next = applyLiveResponse(run, {
      state: { age: 1 },
      events: [],
      decision: null,
      token: null,
    });
    expect(next.token).toBe("tok_1");
  });
});

describe("journalFromResponse", () => {
  it("maps both two- and three-element events", () => {
    const entries = journalFromResponse(
      {
        state: { age: 2 },
        events: [
          [2, "You spoke your first word."],
          [2, "A historical note.", "UN source"],
        ],
        decision: null,
        token: "t",
      },
      "event",
    );
    expect(entries).toHaveLength(2);
    expect(entries[1]!.source).toBe("UN source");
  });
});

describe("addThought", () => {
  it("stores the thought and appends a journal entry", () => {
    const run = createRun({}, start);
    const next = addThought(run, 5, "I took clean water for granted.");
    expect(next.thoughts[5]).toBe("I took clean water for granted.");
    expect(next.journal.at(-1)).toMatchObject({
      kind: "thought",
      age: 5,
    });
  });
});

describe("completeRun", () => {
  it("builds a memorial summary", () => {
    const run = createRun({ year: 1995 }, start);
    const done = applyLiveResponse(run, {
      state: { age: 80, name: "Lan", year: 2075 },
      events: [],
      decision: null,
      token: "tok_2",
      ended: true,
      death: { age: 80, cause: "old age" },
    });
    const life = completeRun(done, ["Birth", "First day of school"]);
    expect(life).toMatchObject({
      name: "Lan",
      country: "VNM",
      bornYear: 1995,
      diedYear: 2075,
      ageAtDeath: 80,
      cause: "old age",
    });
    expect(life.sceneTitles).toEqual(["Birth", "First day of school"]);
  });
});
