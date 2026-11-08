import { describe, expect, it } from "vitest";
import { drawBirth } from "@/game/sim/birth";
import { emigrantOutflow, emigrantStock, emigrationChance, pickDestination, rollMigration, townMoveChance } from "@/game/sim/migration";
import { createRng } from "@/game/sim/rng";
import { urbanShare } from "@/game/sim/tables";
import { liveYear, nextYear } from "@/game/sim/year";

const SLOW = 60_000;

describe("emigration rates", () => {
  it("has no departures before 1975, peaks around 1979, and continues after 1990", () => {
    expect(emigrantOutflow(1970)).toBe(0);
    expect(emigrantOutflow(1979)).toBeGreaterThan(emigrantOutflow(1984));
    expect(emigrantOutflow(2010)).toBeGreaterThan(0);
    expect(emigrantStock(2007)).toBeGreaterThan(emigrantStock(2005));
  });

  it("weights departures before 1990 toward the South", () => {
    expect(emigrationChance(1979, "south")).toBeGreaterThan(emigrationChance(1979, "north"));
    expect(emigrationChance(2010, "south")).toBe(emigrationChance(2010, "north"));
  });

  it("sends most emigrants to the United States", () => {
    const rng = createRng(1);
    let us = 0;
    for (let i = 0; i < 5000; i++) if (pickDestination(1985, rng) === "United States of America") us++;
    expect(us / 5000).toBeGreaterThan(0.3);
  });

  it("moves villagers to towns only while the urban share rises", () => {
    expect(townMoveChance(2010)).toBeGreaterThan(0);
    expect(townMoveChance(2010)).toBeLessThan(0.2);
  });
});

describe("rollMigration", () => {
  it("does nothing for children, people abroad, or after death", () => {
    const rng = createRng(2);
    const state = drawBirth({ seed: 2, year: 2000, place: "village" }, rng);
    expect(rollMigration(state, rng)).toEqual([]);
    state.age = 25;
    state.year = 2025;
    state.person.abroad = "Japan";
    expect(rollMigration(state, rng)).toEqual([]);
    delete state.person.abroad;
    state.ended = true;
    expect(rollMigration(state, rng)).toEqual([]);
  });
});

describe("calibration: moves", () => {
  it("puts a share of adults in towns close to the urban share (±8 points) in 2019", () => {
    let adults = 0;
    let town = 0;
    for (let i = 0; i < 3000; i++) {
      const seed = 50_000 + i;
      const rng = createRng(seed);
      const state = drawBirth({ seed, year: 1960 + (i % 40) }, rng);
      while (!state.ended && state.year < 2019) {
        liveYear(state, rng);
        nextYear(state);
      }
      if (state.ended || state.person.abroad || state.age < 20) continue;
      adults++;
      if (state.person.place === "town") town++;
    }
    const simulated = town / adults;
    console.log(`adults in towns 2019: ${(simulated * 100).toFixed(1)}% vs urban share ${(urbanShare(2019) * 100).toFixed(1)}%`);
    expect(Math.abs(simulated - urbanShare(2019))).toBeLessThan(0.08);
  }, SLOW);

  // The 1990 stock (1.13 million) left mostly from the South and as young adults, so a southern
  // cohort that was 15-24 in 1979 should show a clearly higher share than the national 1.7%.
  it("lets about 2–12% of people born in the South around 1960 emigrate by 1995", () => {
    let alive = 0;
    let abroad = 0;
    for (let i = 0; i < 3000; i++) {
      const seed = 60_000 + i;
      const rng = createRng(seed);
      const state = drawBirth({ seed, year: 1955 + (i % 10), region: "south" }, rng);
      while (!state.ended && state.year < 1995) {
        liveYear(state, rng);
        nextYear(state);
      }
      if (state.ended) continue;
      alive++;
      if (state.person.abroad) abroad++;
    }
    console.log(`born in the South 1955-64, abroad by 1995: ${((abroad / alive) * 100).toFixed(1)}%`);
    expect(abroad / alive).toBeGreaterThan(0.02);
    expect(abroad / alive).toBeLessThan(0.12);
  }, SLOW);
});
