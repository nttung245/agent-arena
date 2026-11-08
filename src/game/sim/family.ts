/**
 * Partners, children, younger siblings, divorce and widowhood.
 *
 * - A first partnership comes at the yearly rate implied by the UN's
 *   ever-married shares by age (marriage.json), from age 16.
 * - Births happen only within a partnership, at the UN's fertility rate for the
 *   woman's age divided by the share of women that age who are married, so the
 *   national birth rate is unchanged.
 * - Divorce and repartnering use estimates from effects.yaml.
 */
import { drawSex, makeName, pickFamilyName } from "@/game/sim/birth";
import { EFFECTS } from "@/game/sim/causes";
import { MIN_PARTNER_AGE, type Relative, type SimEvent, type SimState } from "@/game/sim/person";
import { roll } from "@/game/sim/pick";
import type { Rng } from "@/game/sim/rng";
import { birthChance, everMarried, type Sex } from "@/game/sim/tables";

const FAMILY = EFFECTS.family;
const FERTILE_FROM = 15;
const FERTILE_TO = 49;
/** The married share used to turn population fertility into married fertility never drops below this. */
const MIN_MARRIED_SHARE = 0.05;

/** Yearly chance that a never-partnered person of this sex and age partners this year. */
export function firstPartnerChance(sex: Sex, year: number, age: number): number {
  if (age < MIN_PARTNER_AGE) return 0;
  const now = everMarried(sex, year, age);
  const next = everMarried(sex, year, age + 1);
  if (now >= 0.999) return 0;
  return Math.min(Math.max((next - now) / (1 - now), 0), 0.5);
}

/** Yearly chance that a partnered woman of this age gives birth. */
export function maritalBirthChance(year: number, womanAge: number): number {
  if (womanAge < FERTILE_FROM || womanAge > FERTILE_TO) return 0;
  const married = Math.max(everMarried("female", year, womanAge), MIN_MARRIED_SHARE);
  return Math.min(birthChance(year, womanAge) / married, FAMILY.maxBirthChance);
}

export function divorceChance(year: number): number {
  return year < FAMILY.divorce.year ? FAMILY.divorce.before : FAMILY.divorce.from;
}

function newRelative(state: SimState, fields: Omit<Relative, "id">): Relative {
  const relative: Relative = { id: `r${state.nextRelativeId++}`, ...fields };
  state.relatives.push(relative);
  return relative;
}

function bornThisYear(state: SimState, role: Relative["role"]): boolean {
  return state.relatives.some((r) => r.role === role && r.birthYear === state.year);
}

/** The mother keeps having children while the person is young, both parents alive. */
function rollYoungerSibling(state: SimState, rng: Rng): SimEvent | null {
  if (state.age === 0 || bornThisYear(state, "sibling")) return null;
  const mother = state.relatives.find((r) => r.role === "mother");
  const father = state.relatives.find((r) => r.role === "father");
  if (!mother?.alive || !father?.alive) return null;
  const motherAge = state.year - mother.birthYear;
  if (!roll(rng, maritalBirthChance(state.year, motherAge))) return null;
  const sex = drawSex(rng, state.year);
  const sibling = newRelative(state, {
    role: "sibling",
    sex,
    birthYear: state.year,
    alive: true,
    ...makeName(rng, father.familyName, sex, state.year),
  });
  return { type: "siblingBorn", relativeId: sibling.id };
}

/** A partner who has come into the person's life, before the person says yes. */
export interface PartnerDraft {
  sex: Sex;
  birthYear: number;
  name: string;
  familyName: string;
  givenName: string;
}

/** Rolls whether someone comes into an unpartnered person's life this year. */
export function proposePartner(state: SimState, rng: Rng): PartnerDraft | null {
  if (state.ended || state.partnerId !== null) return null;
  const { person, year, age } = state;
  const hadPartner = state.relatives.some((r) => r.role === "partner");
  const chance = hadPartner
    ? age <= FAMILY.repartner.maxAge
      ? FAMILY.repartner.chance
      : 0
    : firstPartnerChance(person.sex, year, age);
  if (!roll(rng, chance)) return null;
  const gap = FAMILY.partnerGapMin + Math.floor(rng.next() * (FAMILY.partnerGapMax - FAMILY.partnerGapMin + 1));
  const partnerSex: Sex = person.sex === "female" ? "male" : "female";
  const partnerAge = Math.max(person.sex === "female" ? age + gap : age - gap, MIN_PARTNER_AGE);
  const birthYear = year - partnerAge;
  return { sex: partnerSex, birthYear, ...makeName(rng, pickFamilyName(rng, person.region), partnerSex, birthYear) };
}

/** The person says yes: the draft becomes their partner from this year. */
export function addPartner(state: SimState, draft: PartnerDraft): SimEvent {
  const partner = newRelative(state, { role: "partner", alive: true, since: state.year, ...draft });
  state.partnerId = partner.id;
  return { type: "partnered", relativeId: partner.id };
}

function rollChild(state: SimState, partner: Relative, rng: Rng): SimEvent | null {
  if (bornThisYear(state, "child") || state.flags.noMoreChildren) return null;
  const { person, year } = state;
  const womanAge = person.sex === "female" ? state.age : year - partner.birthYear;
  if (!roll(rng, maritalBirthChance(year, womanAge))) return null;
  const sex = drawSex(rng, year);
  const fatherFamily = person.sex === "male" ? person.familyName : partner.familyName;
  const child = newRelative(state, {
    role: "child",
    sex,
    birthYear: year,
    alive: true,
    otherParentId: partner.id,
    ...makeName(rng, fatherFamily, sex, year),
  });
  return { type: "childBorn", relativeId: child.id };
}

/**
 * One year of family life without a new partner: a younger sibling, then
 * divorce or a child within a partnership.
 */
export function rollFamilyLife(state: SimState, rng: Rng): SimEvent[] {
  if (state.ended) return [];
  const events: SimEvent[] = [];

  const sibling = rollYoungerSibling(state, rng);
  if (sibling) events.push(sibling);

  const partner = state.relatives.find((r) => r.id === state.partnerId);
  if (partner) {
    if (roll(rng, divorceChance(state.year))) {
      partner.divorcedYear = state.year;
      state.partnerId = null;
      events.push({ type: "divorced", relativeId: partner.id });
      return events;
    }
    const child = rollChild(state, partner, rng);
    if (child) events.push(child);
  }
  return events;
}

/** One year of family life, saying yes to any new partner. */
export function rollFamily(state: SimState, rng: Rng): SimEvent[] {
  if (state.ended) return [];
  const hadPartner = state.partnerId !== null;
  const events = rollFamilyLife(state, rng);
  if (hadPartner || events.some((e) => e.type === "divorced")) return events;
  const draft = proposePartner(state, rng);
  if (draft) events.push(addPartner(state, draft));
  return events;
}
