import { afterEach, describe, expect, it } from "vitest";
import {
  LIFE_LIVES_STORAGE,
  LIFE_RUN_STORAGE,
  clearRun,
  loadCompletedLives,
  loadRun,
  saveCompletedLife,
  saveRun,
} from "@/game/state/persistence";
import { completeRun, createRun } from "@/game/state/lifeRun";
import type { LiveResponse } from "@/game/engine/types";

const start: LiveResponse = {
  state: { age: 0, name: "Lan", year: 1995, country: "VNM" },
  events: [[0, "You were born."]],
  decision: null,
  token: "tok_1",
  ended: false,
};

afterEach(() => localStorage.clear());

describe("run persistence", () => {
  it("round-trips a run and never stores the API key", () => {
    const run = createRun({ year: 1995 }, start);
    saveRun(run);
    const raw = localStorage.getItem(LIFE_RUN_STORAGE) ?? "";
    expect(raw).not.toContain("k8b_");
    expect(loadRun()?.state.name).toBe("Lan");
    clearRun();
    expect(loadRun()).toBeNull();
  });

  it("returns null for corrupt data", () => {
    localStorage.setItem(LIFE_RUN_STORAGE, "{nope");
    expect(loadRun()).toBeNull();
  });
});

describe("completed lives", () => {
  it("prepends a life and caps the list", () => {
    const run = createRun({ year: 1995 }, start);
    for (let i = 0; i < 25; i++) {
      saveCompletedLife(completeRun(run, []));
    }
    const lives = loadCompletedLives();
    expect(lives).toHaveLength(20);
    expect(localStorage.getItem(LIFE_LIVES_STORAGE)).not.toContain("k8b_");
  });
});
