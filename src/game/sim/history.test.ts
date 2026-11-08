import { describe, expect, it } from "vitest";
import { drawBirth } from "@/game/sim/birth";
import { HISTORY, historyApplies, historyRow, rollHistory } from "@/game/sim/history";
import { checkInvariants, type SimState } from "@/game/sim/person";
import { createRng } from "@/game/sim/rng";
import { liveYear, nextYear } from "@/game/sim/year";

function lifeIds(seed: number, options: Parameters<typeof drawBirth>[0]): { state: SimState; ids: string[]; ages: Map<string, number> } {
  const rng = createRng(seed);
  const state = drawBirth(options, rng);
  const ids: string[] = [];
  const ages = new Map<string, number>();
  while (!state.ended) {
    for (const e of liveYear(state, rng)) {
      if (e.type === "history") {
        ids.push(e.id);
        if (!ages.has(e.id)) ages.set(e.id, state.age);
      }
    }
    const errors = checkInvariants(state);
    if (errors.length) throw new Error(`seed ${seed} age ${state.age}: ${errors.join("; ")}`);
    nextYear(state);
  }
  return { state, ids, ages };
}

describe("history.yaml", () => {
  it("has unique ids, valid years and a source for every row", () => {
    const ids = new Set<string>();
    for (const row of HISTORY) {
      expect(ids.has(row.id)).toBe(false);
      ids.add(row.id);
      expect(row.from).toBeLessThanOrEqual(row.to);
      expect(row.text.length).toBeGreaterThan(10);
      expect(row.source.length).toBeGreaterThan(5);
    }
    expect(historyRow("reunification")?.from).toBe(1975);
    expect(historyRow("nope")).toBeUndefined();
  });
});

describe("rollHistory", () => {
  it("never gives a life born in 2005 a war-era row", () => {
    const warRows = HISTORY.filter((row) => row.to <= 1989).map((row) => row.id);
    for (let i = 0; i < 200; i++) {
      const { ids } = lifeIds(i, { seed: i, year: 2005 });
      for (const id of ids) expect(warRows).not.toContain(id);
    }
  });

  it("gives a life born in 1950 the escalation at 15 and reunification at 25, but not the partition at 4", () => {
    let checked = 0;
    for (let i = 0; i < 300 && checked < 20; i++) {
      const { ages } = lifeIds(1000 + i, { seed: 1000 + i, year: 1950, region: "north", faith: "none" });
      if (!ages.has("reunification")) continue; // died before 1975, or moved abroad
      checked++;
      expect(ages.has("partition")).toBe(false); // rows reach people from age 5 unless they say otherwise
      expect(ages.get("war_escalates")).toBe(15);
      expect(ages.get("reunification")).toBe(25);
    }
    expect(checked).toBeGreaterThan(5);
  });

  it("calls up only men, and only at the ages the row allows", () => {
    for (let i = 0; i < 300; i++) {
      const sex = i % 2 ? "male" : "female";
      const { ids, ages } = lifeIds(2000 + i, { seed: 2000 + i, year: 1945 + (i % 30), sex });
      if (sex === "female") expect(ids).not.toContain("military_service_war");
      const at = ages.get("military_service_war");
      if (at !== undefined) expect(at >= 18 && at <= 30).toBe(true);
    }
  });

  it("fires each one-time row at most once, and lets storms repeat", () => {
    let repeatedStorm = false;
    for (let i = 0; i < 200; i++) {
      const { ids } = lifeIds(3000 + i, { seed: 3000 + i, year: 1960, region: "central" });
      const once = ids.filter((id) => !historyRow(id)!.repeat);
      expect(new Set(once).size).toBe(once.length);
      if (ids.filter((id) => id === "storm_season").length > 1) repeatedStorm = true;
    }
    expect(repeatedStorm).toBe(true);
  });

  it("moves many northern Catholic families south in 1954, and few others", () => {
    const moved = (faith: string) => {
      let n = 0;
      for (let i = 0; i < 400; i++) {
        const rng = createRng(4000 + i);
        const state = drawBirth({ seed: 4000 + i, year: 1950, region: "north", faith }, rng);
        while (!state.ended && state.year < 1956) {
          liveYear(state, rng);
          nextYear(state);
        }
        if (state.person.region === "south") n++;
      }
      return n / 400;
    };
    expect(moved("catholic")).toBeGreaterThan(0.4);
    expect(moved("none")).toBeLessThan(0.2);
  });

  it("does not reach people abroad, or after death", () => {
    const rng = createRng(1);
    const state = drawBirth({ seed: 1, year: 1950 }, rng);
    state.age = 25;
    state.year = 1975;
    expect(historyApplies(historyRow("reunification")!, state)).toBe(true);
    state.person.abroad = "France";
    expect(rollHistory(state, rng)).toEqual([]);
    delete state.person.abroad;
    state.ended = true;
    expect(rollHistory(state, rng)).toEqual([]);
  });
});
