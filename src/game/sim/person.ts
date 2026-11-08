/**
 * The simulated life's whole state. It is plain JSON so it can travel in the
 * token; the engine never keeps anything outside it.
 */
import type { LifeRegion } from "@/game/engine/types";
import type { RngState } from "@/game/sim/rng";
import type { Sex } from "@/game/sim/tables";

export type Place = "town" | "village";
/** Family income fifth at birth: 1 is the poorest fifth, 5 the richest. */
export type Fifth = 1 | 2 | 3 | 4 | 5;
export type Faith = "none" | "buddhist" | "catholic" | "protestant" | "hoaHao" | "caoDai" | "other";
export type RelativeRole = "mother" | "father" | "sibling" | "partner" | "child";

export interface PersonName {
  /** Family, middle and given name: "Nguyễn Thị Lan". */
  name: string;
  familyName: string;
  givenName: string;
}

export interface Relative extends PersonName {
  id: string;
  role: RelativeRole;
  sex: Sex;
  birthYear: number;
  alive: boolean;
  diedYear?: number;
  cause?: string;
  /** Partners: the year the partnership began, and the year it ended in divorce. */
  since?: number;
  divorcedYear?: number;
  /** Children: the id of the other parent (a partner of the person). */
  otherParentId?: string;
}

export interface Person extends PersonName {
  sex: Sex;
  birthYear: number;
  region: LifeRegion;
  birthPlace: Place;
  /** Where the person lives now. */
  place: Place;
  fifth: Fifth;
  faith: Faith;
}

/** 0–100 each. */
export interface Stats {
  health: number;
  happiness: number;
  knowledge: number;
  bonds: number;
}

export interface SimDeath {
  age: number;
  year: number;
  cause: string;
}

/** A long illness the person is living with. */
export interface Illness {
  cause: string;
  /** Year of diagnosis. */
  since: number;
  treated: boolean;
}

/**
 * What happened, as data. text.ts turns these into journal lines; keeping them
 * structured lets the scene director and tests read them without parsing text.
 */
export type SimEvent =
  | { type: "diagnosed" | "recovered" | "worsened"; cause: string }
  | { type: "relativeDied"; relativeId: string; cause: string }
  | { type: "partnered" | "divorced" | "widowed" | "childBorn" | "siblingBorn"; relativeId: string }
  | { type: "died"; cause: string };

export interface SimState {
  version: 1;
  seed: number;
  rng: RngState;
  person: Person;
  /** Completed years of age. */
  age: number;
  /** Calendar year the person is living: always birthYear + age. */
  year: number;
  relatives: Relative[];
  nextRelativeId: number;
  stats: Stats;
  /** The current partner's relative id, or null. */
  partnerId: string | null;
  illnesses: Illness[];
  ended: boolean;
  death: SimDeath | null;
}

export const STAT_KEYS = ["health", "happiness", "knowledge", "bonds"] as const;

const FERTILE_FROM = 15;
const FERTILE_TO = 49;
const MIN_FATHER_AGE = 16;
export const MIN_PARTNER_AGE = 16;

/**
 * Every rule a life must never break. Returns one message per violation, so a
 * test can run thousands of lives and print what went wrong.
 */
export function checkInvariants(state: SimState): string[] {
  const errors: string[] = [];
  const { person, relatives } = state;
  const fail = (message: string) => errors.push(message);

  if (state.year !== person.birthYear + state.age) fail(`year ${state.year} != birthYear + age`);
  if (state.age < 0) fail(`negative age ${state.age}`);
  for (const key of STAT_KEYS) {
    const value = state.stats[key];
    if (!(value >= 0 && value <= 100)) fail(`stat ${key} out of range: ${value}`);
  }
  if (state.ended !== (state.death !== null)) fail("ended and death disagree");
  if (state.death && state.death.year !== person.birthYear + state.death.age) fail("death year != birth + age");

  const ids = new Set<string>();
  for (const r of relatives) {
    if (ids.has(r.id)) fail(`duplicate relative id ${r.id}`);
    ids.add(r.id);
    if (r.birthYear > state.year) fail(`${r.role} ${r.id} born after the current year`);
    if (!r.alive) {
      if (r.diedYear === undefined) fail(`${r.role} ${r.id} is dead with no year`);
      else if (r.diedYear < r.birthYear || r.diedYear > state.year) fail(`${r.role} ${r.id} died outside their life`);
    } else if (r.diedYear !== undefined) {
      fail(`${r.role} ${r.id} is alive with a death year`);
    }
  }

  const causes = new Set<string>();
  for (const illness of state.illnesses) {
    if (causes.has(illness.cause)) fail(`two illnesses with cause ${illness.cause}`);
    causes.add(illness.cause);
    if (illness.since < person.birthYear || illness.since > state.year) fail(`illness ${illness.cause} outside the life`);
  }

  const mother = relatives.find((r) => r.role === "mother");
  const father = relatives.find((r) => r.role === "father");
  if (relatives.filter((r) => r.role === "mother").length !== 1) fail("not exactly one mother");
  if (relatives.filter((r) => r.role === "father").length !== 1) fail("not exactly one father");
  if (mother) {
    if (mother.sex !== "female") fail("mother is not female");
    const ageAtBirth = person.birthYear - mother.birthYear;
    if (ageAtBirth < FERTILE_FROM || ageAtBirth > FERTILE_TO) fail(`mother was ${ageAtBirth} at the birth`);
    if (mother.diedYear !== undefined && mother.diedYear < person.birthYear) fail("mother died before the birth");
  }
  if (father) {
    if (father.sex !== "male") fail("father is not male");
    if (person.birthYear - father.birthYear < MIN_FATHER_AGE) fail("father too young at the birth");
    if (father.familyName !== person.familyName) fail("child does not carry the father's family name");
  }
  const partners = relatives.filter((r) => r.role === "partner");
  if (state.partnerId !== null) {
    const partner = partners.find((p) => p.id === state.partnerId);
    if (!partner) fail(`partnerId ${state.partnerId} is not a partner`);
    else if (!partner.alive || partner.divorcedYear !== undefined) fail("current partner is dead or divorced");
  }
  for (const partner of partners) {
    if (partner.since === undefined) fail(`partner ${partner.id} has no start year`);
    else {
      if (partner.since - person.birthYear < MIN_PARTNER_AGE) fail(`partnered at ${partner.since - person.birthYear}`);
      if (partner.since - partner.birthYear < MIN_PARTNER_AGE) fail(`partner ${partner.id} was ${partner.since - partner.birthYear}`);
    }
    if (partner.sex === person.sex) fail(`partner ${partner.id} has the same sex`);
  }
  for (const child of relatives.filter((r) => r.role === "child")) {
    const other = partners.find((p) => p.id === child.otherParentId);
    if (!other) {
      fail(`child ${child.id} has no other parent`);
      continue;
    }
    if (other.since === undefined || child.birthYear < other.since) fail(`child ${child.id} born before the partnership`);
    if (other.divorcedYear !== undefined && child.birthYear > other.divorcedYear) fail(`child ${child.id} born after the divorce`);
    const mother = person.sex === "female" ? { birthYear: person.birthYear, diedYear: state.death?.year } : other;
    const motherAge = child.birthYear - mother.birthYear;
    if (motherAge < FERTILE_FROM || motherAge > FERTILE_TO) fail(`child ${child.id} born to a mother of ${motherAge}`);
    if (mother.diedYear !== undefined && child.birthYear > mother.diedYear) fail(`child ${child.id} born after the mother died`);
    const fatherFamily = person.sex === "male" ? person.familyName : other.familyName;
    if (child.familyName !== fatherFamily) fail(`child ${child.id} does not carry the father's family name`);
  }
  for (const sibling of relatives.filter((r) => r.role === "sibling")) {
    if (!mother) break;
    const motherAge = sibling.birthYear - mother.birthYear;
    if (motherAge < FERTILE_FROM || motherAge > FERTILE_TO) fail(`sibling ${sibling.id} born to a mother of ${motherAge}`);
    if (mother.diedYear !== undefined && sibling.birthYear > mother.diedYear) fail(`sibling ${sibling.id} born after the mother died`);
  }
  return errors;
}
