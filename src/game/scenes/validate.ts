import type { LifeState } from "@/game/engine/types";
import type {
  LifeFactPerson,
  LifeFactSheet,
  LifeTemplateId,
  ScenePlan,
  SceneTemplate,
} from "@/game/scenes/types";

const TEMPLATE_IDS: ReadonlySet<string> = new Set<LifeTemplateId>([
  "birth_home",
  "birth_hospital",
  "home_childhood",
  "home_family",
  "school_classroom",
  "schoolyard",
  "street_neighborhood",
  "workplace_office",
  "workplace_shop",
  "workplace_factory",
  "farm_field",
  "hospital",
  "temple_church",
  "cemetery_memorial",
  "wedding_home",
  "station",
]);

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function asArray(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

function asPerson(value: unknown, role: string): LifeFactPerson | null {
  if (!isRecord(value)) return null;
  const name = typeof value.name === "string" ? value.name.trim() : "";
  if (!name) return null;
  const age = typeof value.age === "number" ? value.age : undefined;
  const alive = value.alive === false || value.dead === true ? false : true;
  return { name, role, age, alive };
}

function householdPeople(value: unknown): unknown[] {
  if (Array.isArray(value)) return value;
  if (isRecord(value) && Array.isArray(value.members)) return value.members;
  return [];
}

export function buildFactSheet(state: LifeState): LifeFactSheet {
  const people: LifeFactPerson[] = [];

  for (const [key, role] of [
    ["mother", "mother"],
    ["father", "father"],
  ] as const) {
    const person = asPerson(state[key], role);
    if (person) people.push(person);
  }

  for (const sibling of asArray(state.siblings)) {
    const person = asPerson(sibling, "sibling");
    if (person) people.push(person);
  }

  const partner = asPerson(state.partner, "partner");
  if (partner) people.push(partner);

  const kids = asArray(state.kids ?? state.children);
  const children: string[] = [];
  for (const kid of kids) {
    const person = asPerson(kid, "child");
    if (person) {
      people.push(person);
      children.push(person.name);
    }
  }

  for (const member of householdPeople(state.household)) {
    const person = asPerson(member, "household");
    if (person) people.push(person);
  }

  const place =
    typeof state.place === "string"
      ? state.place
      : typeof state.place === "boolean"
        ? state.place
          ? "city"
          : "village"
        : undefined;

  return {
    playerName:
      typeof state.name === "string" && state.name.trim()
        ? state.name.trim()
        : "You",
    age: typeof state.age === "number" ? state.age : 0,
    year: typeof state.year === "number" ? state.year : undefined,
    place,
    job: typeof state.job === "string" ? state.job : undefined,
    partner: partner?.name,
    children,
    people,
  };
}

export interface SceneValidationContext {
  template: SceneTemplate;
  characterIds: ReadonlySet<string>;
  choiceKeys: readonly string[];
  focusKeys: readonly string[];
  facts: LifeFactSheet;
}

export type ValidationResult =
  | { ok: true; plan: ScenePlan }
  | { ok: false; errors: string[] };

function tooLong(value: unknown, max: number): boolean {
  return typeof value === "string" && value.length > max;
}

export function validateScenePlan(
  plan: unknown,
  ctx: SceneValidationContext,
): ValidationResult {
  const errors: string[] = [];
  if (!isRecord(plan)) return { ok: false, errors: ["invalid_plan"] };

  const templateId = plan.template;
  if (typeof templateId !== "string" || !TEMPLATE_IDS.has(templateId)) {
    errors.push(`unknown_template:${String(templateId)}`);
  }
  if (templateId !== ctx.template.id) {
    errors.push(`template_mismatch:${String(templateId)}`);
  }

  const player = isRecord(plan.player) ? plan.player : null;
  if (
    !player ||
    typeof player.socket !== "string" ||
    !ctx.template.sockets[player.socket]
  ) {
    errors.push(`unknown_socket:${String(player?.socket)}`);
  }

  const knownNames = new Set([
    ctx.facts.playerName,
    ...ctx.facts.people.map((person) => person.name),
  ]);
  const deadNames = new Set(
    ctx.facts.people.filter((person) => !person.alive).map((p) => p.name),
  );

  const cast = asArray(plan.cast);
  for (const member of cast) {
    if (!isRecord(member)) {
      errors.push("invalid_cast");
      continue;
    }
    const socket = member.socket;
    if (typeof socket !== "string" || !ctx.template.sockets[socket]) {
      errors.push(`unknown_socket:${String(socket)}`);
    }
    const characterId = member.characterId;
    if (
      typeof characterId !== "string" ||
      !ctx.characterIds.has(characterId)
    ) {
      errors.push(`unknown_character:${String(characterId)}`);
    }
    const name = member.name;
    if (typeof name !== "string" || !knownNames.has(name)) {
      errors.push(`unknown_person:${String(name)}`);
    } else if (
      plan.memory !== true &&
      deadNames.has(name) &&
      Array.isArray(member.lines) &&
      member.lines.length > 0
    ) {
      errors.push(`dead_speaks:${name}`);
    }
    if (Array.isArray(member.lines)) {
      for (const line of member.lines) {
        if (tooLong(line, 240)) errors.push(`line_too_long:${name}`);
      }
    }
  }

  const interactables = asArray(plan.interactables);
  const interactableIds = new Set<string>();
  for (const item of interactables) {
    if (!isRecord(item)) {
      errors.push("invalid_interactable");
      continue;
    }
    const socket = item.socket;
    if (typeof socket !== "string" || !ctx.template.sockets[socket]) {
      errors.push(`unknown_socket:${String(socket)}`);
    }
    if (typeof item.id === "string") interactableIds.add(item.id);
  }

  const bindings = isRecord(plan.choiceBindings) ? plan.choiceBindings : {};
  for (const key of ctx.choiceKeys) {
    const binding = bindings[key];
    if (typeof binding !== "string") {
      errors.push(`missing_choice:${key}`);
    } else if (!interactableIds.has(binding)) {
      errors.push(`unknown_binding:${key}`);
    }
  }

  for (const key of ctx.focusKeys) {
    const found = interactables.some(
      (item) => isRecord(item) && item.focusKey === key,
    );
    if (!found) errors.push(`missing_focus:${key}`);
  }

  if (tooLong(plan.title, 80)) errors.push("title_too_long");
  if (tooLong(plan.summary, 240)) errors.push("summary_too_long");
  for (const line of asArray(plan.dialogue)) {
    if (isRecord(line) && tooLong(line.text, 240)) {
      errors.push("dialogue_too_long");
    }
  }

  if (errors.length) return { ok: false, errors };
  return { ok: true, plan: plan as unknown as ScenePlan };
}
