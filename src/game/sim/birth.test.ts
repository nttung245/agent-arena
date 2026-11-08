import { describe, expect, it } from "vitest";
import { BIRTH_YEARS, drawBirth, pickFamilyName } from "@/game/sim/birth";
import { checkInvariants, type SimState } from "@/game/sim/person";
import { createRng } from "@/game/sim/rng";
import { birthChance, boyShare } from "@/game/sim/tables";

function birth(seed: number, options: Partial<Parameters<typeof drawBirth>[0]> = {}): SimState {
  return drawBirth({ seed, ...options }, createRng(seed));
}

function many(n: number, options: Partial<Parameters<typeof drawBirth>[0]> = {}): SimState[] {
  return Array.from({ length: n }, (_, i) => birth(1000 + i, options));
}

describe("drawBirth", () => {
  it("respects every condition the player sets", () => {
    const s = birth(1, { year: 1968, sex: "female", region: "central", place: "village", fifth: "2", faith: "catholic" });
    expect(s.person).toMatchObject({
      birthYear: 1968,
      sex: "female",
      region: "central",
      place: "village",
      birthPlace: "village",
      fifth: 2,
      faith: "catholic",
    });
    expect(s.year).toBe(1968);
    expect(s.age).toBe(0);
  });

  it("clamps the birth year to 1950–2025 and defaults to 2025", () => {
    expect(birth(2, { year: 1900 }).person.birthYear).toBe(BIRTH_YEARS.first);
    expect(birth(3, { year: 2090 }).person.birthYear).toBe(BIRTH_YEARS.last);
    expect(birth(4).person.birthYear).toBe(BIRTH_YEARS.default);
  });

  it("ignores conditions it does not know and draws instead", () => {
    const s = birth(5, { fifth: "rich", faith: "jedi", sex: "random" });
    expect([1, 2, 3, 4, 5]).toContain(s.person.fifth);
    expect(s.person.faith).not.toBe("jedi");
  });

  it("gives the same family for the same seed", () => {
    expect(birth(77, { year: 1990 })).toEqual(birth(77, { year: 1990 }));
    expect(birth(77, { year: 1990 })).not.toEqual(birth(78, { year: 1990 }));
  });

  it("never breaks a family rule over 5,000 births across the years", () => {
    for (let i = 0; i < 5000; i++) {
      const s = birth(i, { year: 1950 + (i % 76) });
      const errors = checkInvariants(s);
      if (errors.length > 0) throw new Error(`seed ${i}: ${errors.join("; ")}`);
    }
  });

  it("draws boys at the table's sex ratio", () => {
    const n = 20_000;
    const boys = many(n, { year: 2010 }).filter((s) => s.person.sex === "male").length;
    expect(Math.abs(boys / n - boyShare(2010))).toBeLessThan(0.01);
  });

  it("draws the mother's age in proportion to fertility by age", () => {
    const year = 1990;
    let weighted = 0;
    let total = 0;
    for (let age = 15; age <= 49; age++) {
      weighted += age * birthChance(year, age);
      total += birthChance(year, age);
    }
    const expected = weighted / total;
    const births = many(5000, { year });
    const mean =
      births.reduce((sum, s) => sum + (year - s.relatives.find((r) => r.role === "mother")!.birthYear), 0) /
      births.length;
    expect(Math.abs(mean - expected)).toBeLessThan(0.5);
  });

  it("gives babies born in 1960 more older siblings than babies born in 2010", () => {
    const siblings = (year: number) =>
      many(3000, { year }).reduce((sum, s) => sum + s.relatives.filter((r) => r.role === "sibling").length, 0) / 3000;
    expect(siblings(1960)).toBeGreaterThan(siblings(2010) + 1);
  });

  it("names children after their father's family", () => {
    for (const s of many(500)) {
      const father = s.relatives.find((r) => r.role === "father")!;
      expect(s.person.familyName).toBe(father.familyName);
      expect(s.person.name.startsWith(`${s.person.familyName} `)).toBe(true);
      expect(s.person.name.endsWith(` ${s.person.givenName}`)).toBe(true);
    }
  });

  it("starts with stats in range", () => {
    const s = birth(9);
    expect(s.stats.health).toBeGreaterThanOrEqual(65);
    expect(s.stats.health).toBeLessThanOrEqual(90);
  });
});

describe("pickFamilyName", () => {
  it("gives Nguyễn to about 38% of people", () => {
    const rng = createRng(11);
    const n = 20_000;
    let nguyen = 0;
    for (let i = 0; i < n; i++) if (pickFamilyName(rng, "north") === "Nguyễn") nguyen++;
    expect(Math.abs(nguyen / n - 0.384)).toBeLessThan(0.015);
  });

  it("spells Hoàng and Vũ as Huỳnh and Võ outside the North", () => {
    const rng = createRng(12);
    const south = new Set(Array.from({ length: 5000 }, () => pickFamilyName(rng, "south")));
    expect(south.has("Huỳnh")).toBe(true);
    expect(south.has("Hoàng")).toBe(false);
    expect(south.has("Võ")).toBe(true);
  });
});

describe("checkInvariants", () => {
  it("reports a broken family", () => {
    const s = birth(21, { year: 1980 });
    const mother = s.relatives.find((r) => r.role === "mother")!;
    mother.birthYear = 1975; // five years old at the birth
    mother.alive = false; // dead with no year
    s.year = 1999;
    s.stats.health = 140;
    s.relatives.push({ ...mother, role: "father" });
    const errors = checkInvariants(s).join("\n");
    expect(errors).toMatch(/year 1999 != birthYear \+ age/);
    expect(errors).toMatch(/stat health out of range/);
    expect(errors).toMatch(/mother was 5 at the birth/);
    expect(errors).toMatch(/dead with no year/);
    expect(errors).toMatch(/duplicate relative id/);
    expect(errors).toMatch(/not exactly one father/);
  });
});
