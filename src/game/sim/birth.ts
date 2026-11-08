/**
 * Draws a birth: who the person is, where, and into which family. Every draw
 * goes through the seeded generator, so the same seed gives the same family.
 */
import birthRaw from "@data/life/birth.yaml";
import namesRaw from "@data/life/names.yaml";
import type { LifeRegion } from "@/game/engine/types";
import type { Faith, Fifth, Person, PersonName, Place, Relative, SimState } from "@/game/sim/person";
import { roll, weightedPick } from "@/game/sim/pick";
import type { Rng } from "@/game/sim/rng";
import { birthChance, boyShare, deathChance, urbanShare, type Sex } from "@/game/sim/tables";

interface BirthData {
  regions: { shares: Record<LifeRegion, number> };
  faiths: { shares: Record<Faith, number> };
  parents: { fatherGapMin: number; fatherGapMax: number; minFatherAge: number };
  stats: { healthMin: number; healthMax: number; happiness: number; knowledge: number; bonds: number };
}

interface NamesData {
  familyNames: { shares: { name: string; south?: string; share: number }[]; others: string[] };
  eras: [number, number];
  middleNames: Record<Sex, [string[], string[], string[]]>;
  givenNames: Record<Sex, [string[], string[], string[]]>;
}

const BIRTH = birthRaw as BirthData;
const NAMES = namesRaw as NamesData;

export const BIRTH_YEARS = { first: 1950, last: 2025, default: 2025 } as const;
const FERTILE_FROM = 15;
const FERTILE_TO = 49;

export interface BirthOptions {
  seed: number;
  year?: number;
  sex?: Sex | "random";
  region?: LifeRegion;
  place?: Place;
  /** "1"–"5" or 1–5; anything else draws a fifth at random. */
  fifth?: string | number;
  faith?: string;
}

function pickShare<K extends string>(rng: Rng, shares: Readonly<Record<K, number>>): K {
  return weightedPick(
    rng,
    (Object.entries(shares) as [K, number][]).map(([key, weight]) => ({ key, weight })),
  );
}

function pickFrom<T>(rng: Rng, list: readonly T[]): T {
  return list[Math.min(list.length - 1, Math.floor(rng.next() * list.length))];
}

function eraOf(year: number): 0 | 1 | 2 {
  if (year <= NAMES.eras[0]) return 0;
  if (year <= NAMES.eras[1]) return 1;
  return 2;
}

/** A family name by population share; Hoàng/Vũ are spelled Huỳnh/Võ outside the North. */
export function pickFamilyName(rng: Rng, region: LifeRegion): string {
  const listed = NAMES.familyNames.shares;
  const listedShare = listed.reduce((sum, entry) => sum + entry.share, 0);
  const others = NAMES.familyNames.others;
  const otherShare = Math.max(0, 1 - listedShare) / others.length;
  const options = [
    ...listed.map((entry, i) => ({ key: `l${i}`, weight: entry.share })),
    ...others.map((_, i) => ({ key: `o${i}`, weight: otherShare })),
  ];
  const key = weightedPick(rng, options);
  if (key.startsWith("o")) return others[Number(key.slice(1))];
  const entry = listed[Number(key.slice(1))];
  return region !== "north" && entry.south ? entry.south : entry.name;
}

export function makeName(rng: Rng, familyName: string, sex: Sex, birthYear: number): PersonName {
  const era = eraOf(birthYear);
  const middle = pickFrom(rng, NAMES.middleNames[sex][era]);
  const givenName = pickFrom(rng, NAMES.givenNames[sex][era]);
  return { name: `${familyName} ${middle} ${givenName}`, familyName, givenName };
}

function clampYear(year: number | undefined): number {
  if (year === undefined || !Number.isFinite(year)) return BIRTH_YEARS.default;
  return Math.min(Math.max(Math.round(year), BIRTH_YEARS.first), BIRTH_YEARS.last);
}

function parseFifth(value: string | number | undefined): Fifth | null {
  const n = Number(value);
  return Number.isInteger(n) && n >= 1 && n <= 5 ? (n as Fifth) : null;
}

function isFaith(value: string | undefined): value is Faith {
  return value !== undefined && value in BIRTH.faiths.shares;
}

export function drawSex(rng: Rng, year: number): Sex {
  return roll(rng, boyShare(year)) ? "male" : "female";
}

/** The mother's age at this birth, in proportion to that year's fertility by age. */
function drawMotherAge(rng: Rng, year: number): number {
  const options = [];
  for (let age = FERTILE_FROM; age <= FERTILE_TO; age++) {
    options.push({ key: String(age), weight: birthChance(year, age) });
  }
  return Number(weightedPick(rng, options));
}

/** Rolls a relative's death each year from their birth up to (not including) `untilYear`. */
function survivesUntil(rng: Rng, relative: Relative, untilYear: number): void {
  for (let year = relative.birthYear; year < untilYear; year++) {
    if (roll(rng, deathChance(relative.sex, year, year - relative.birthYear))) {
      relative.alive = false;
      relative.diedYear = year;
      return;
    }
  }
}

export function drawBirth(options: BirthOptions, rng: Rng): SimState {
  const year = clampYear(options.year);
  const sex: Sex = options.sex === "female" || options.sex === "male" ? options.sex : drawSex(rng, year);
  const region = options.region ?? pickShare(rng, BIRTH.regions.shares);
  const place: Place = options.place ?? (roll(rng, urbanShare(year)) ? "town" : "village");
  const fifth = parseFifth(options.fifth) ?? ((1 + Math.floor(rng.next() * 5)) as Fifth);
  const faith = isFaith(options.faith) ? options.faith : pickShare(rng, BIRTH.faiths.shares);

  let nextId = 1;
  const newId = () => `r${nextId++}`;

  const motherAge = drawMotherAge(rng, year);
  const { fatherGapMin, fatherGapMax, minFatherAge } = BIRTH.parents;
  const gap = fatherGapMin + Math.floor(rng.next() * (fatherGapMax - fatherGapMin + 1));
  const fatherAge = Math.max(motherAge + gap, minFatherAge);

  const familyName = pickFamilyName(rng, region);
  const mother: Relative = {
    id: newId(),
    role: "mother",
    sex: "female",
    birthYear: year - motherAge,
    alive: true,
    ...makeName(rng, pickFamilyName(rng, region), "female", year - motherAge),
  };
  const father: Relative = {
    id: newId(),
    role: "father",
    sex: "male",
    birthYear: year - fatherAge,
    alive: true,
    ...makeName(rng, familyName, "male", year - fatherAge),
  };

  // Older siblings: the mother's earlier births at that era's fertility rates, at most one a year.
  const siblings: Relative[] = [];
  for (let age = FERTILE_FROM; age < motherAge; age++) {
    const siblingYear = mother.birthYear + age;
    if (!roll(rng, birthChance(siblingYear, age))) continue;
    const siblingSex = drawSex(rng, siblingYear);
    const sibling: Relative = {
      id: newId(),
      role: "sibling",
      sex: siblingSex,
      birthYear: siblingYear,
      alive: true,
      ...makeName(rng, familyName, siblingSex, siblingYear),
    };
    survivesUntil(rng, sibling, year);
    siblings.push(sibling);
  }

  const { healthMin, healthMax, happiness, knowledge, bonds } = BIRTH.stats;
  const person: Person = {
    ...makeName(rng, familyName, sex, year),
    sex,
    birthYear: year,
    region,
    birthPlace: place,
    place,
    fifth,
    faith,
  };

  return {
    version: 1,
    seed: options.seed,
    rng: rng.state(),
    person,
    age: 0,
    year,
    relatives: [mother, father, ...siblings],
    nextRelativeId: nextId,
    stats: {
      health: Math.round(healthMin + rng.next() * (healthMax - healthMin)),
      happiness,
      knowledge,
      bonds,
    },
    partnerId: null,
    education: { completed: "none", studying: null },
    work: { status: "notYet", income: 0 },
    illnesses: [],
    seen: [],
    ended: false,
    death: null,
  };
}
