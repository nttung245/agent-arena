import { describe, expect, it } from "vitest";
import { buildReview } from "@/game/engine/review";
import type { LifeRun } from "@/game/state/lifeRun";

const run = {
  state: { age: 80, name: "Lan", year: 2075 },
  config: { year: 1995 },
  death: { age: 80, cause: "old age" },
  journal: [
    { id: "1", age: 0, kind: "birth", text: "Born." },
    { id: "2", age: 6, kind: "event", text: "School." },
    { id: "3", age: 80, kind: "event", text: "Died." },
  ],
  thoughts: { 5: "Water.", 30: "Carrying my family." },
} as unknown as LifeRun;

describe("buildReview", () => {
  it("collects the arc, the key entries, and the thoughts", () => {
    const review = buildReview(run, ["Birth", "School"]);
    expect(review.name).toBe("Lan");
    expect(review.bornYear).toBe(1995);
    expect(review.diedYear).toBe(2075);
    expect(review.ageAtDeath).toBe(80);
    expect(review.cause).toBe("old age");
    expect(review.scenes).toEqual(["Birth", "School"]);
    expect(review.thoughts.map((thought) => thought.age)).toEqual([5, 30]);
  });
});
