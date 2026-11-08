import type { SceneTrigger } from "@/game/engine/chapters";
import type { LifeRun } from "@/game/state/lifeRun";
import type {
  LifeFactSheet,
  LifeTemplateId,
  SceneCastMember,
  SceneInteractable,
  ScenePlan,
  SceneTemplate,
} from "@/game/scenes/types";
import { validateScenePlan } from "@/game/scenes/validate";

export interface DirectorInput {
  trigger: SceneTrigger;
  run: LifeRun;
  facts: LifeFactSheet;
  templates: Record<LifeTemplateId, SceneTemplate>;
  dressing: string[];
}

export interface SceneDirector {
  direct(input: DirectorInput): Promise<ScenePlan>;
}

function has(text: string, needles: string[]): boolean {
  return needles.some((needle) => text.includes(needle));
}

function ageCameraHeight(age: number): number {
  if (age < 3) return 0.7;
  if (age < 12) return 1.1;
  if (age < 18) return 1.4;
  return 1.6;
}

export function selectTemplate(
  trigger: SceneTrigger,
  run: LifeRun,
): LifeTemplateId {
  if (trigger.kind === "death") return "cemetery_memorial";
  if (trigger.kind === "birth") return "birth_home";
  if (trigger.kind === "reflection") {
    return run.state.age >= 18 && run.state.age < 70
      ? "home_family"
      : "home_childhood";
  }

  const decision = trigger.decision;
  if (decision?.template) return decision.template;
  const text = `${decision?.about ?? ""} ${decision?.question ?? ""}`.toLowerCase();

  if (has(text, ["school", "educat", "exam"])) return "school_classroom";
  if (has(text, ["work", "job", "career"])) return "workplace_office";
  if (has(text, ["partner", "marri"])) return "wedding_home";
  if (has(text, ["health", "illness", "hospital"])) return "hospital";
  if (has(text, ["money", "debt"])) return "workplace_shop";
  if (has(text, ["migrat", "move", "abroad"])) return "street_neighborhood";

  return run.state.age < 18 ? "home_childhood" : "home_family";
}

function pickCharacter(
  characterIds: ReadonlySet<string>,
  preferred: string,
): string {
  if (characterIds.has(preferred)) return preferred;
  return [...characterIds][0] ?? preferred;
}

export function createDeterministicDirector(
  characterIds: ReadonlySet<string>,
): SceneDirector {
  const femaleId = pickCharacter(characterIds, "generic-female");
  const maleId = pickCharacter(characterIds, "generic-male");

  return {
    async direct(input: DirectorInput): Promise<ScenePlan> {
      const { trigger, run, facts, templates } = input;
      const templateId = selectTemplate(trigger, run);
      const template = templates[templateId];
      if (!template) {
        throw new Error(`missing_template:${templateId}`);
      }

      const socketFor = (preferred: string): string =>
        template.sockets[preferred] ? preferred : "player_start";

      const cast: SceneCastMember[] = [];
      const mother = facts.people.find((person) => person.role === "mother");
      const father = facts.people.find((person) => person.role === "father");
      if (mother?.alive) {
        cast.push({
          role: "mother",
          name: mother.name,
          age: mother.age ?? run.state.age + 24,
          characterId: femaleId,
          mood: "warm",
          socket: socketFor("mother"),
          lines: [`${mother.name} looks at you.`],
        });
      }
      if (father?.alive) {
        cast.push({
          role: "father",
          name: father.name,
          age: father.age ?? run.state.age + 27,
          characterId: maleId,
          mood: "steady",
          socket: socketFor("father"),
          lines: [`${father.name} is nearby.`],
        });
      }
      if (facts.partner) {
        cast.push({
          role: "partner",
          name: facts.partner,
          age: run.state.age,
          characterId: femaleId,
          mood: "close",
          socket: socketFor("partner"),
          lines: [`${facts.partner} is here with you.`],
        });
      }

      const decision = trigger.decision;
      const choiceKeys = decision?.choices.map((choice) => choice.key) ?? [];
      const interactables: SceneInteractable[] = [];
      const choiceBindings: Record<string, string> = {};

      if (decision) {
        const anchors = template.interactables;
        decision.choices.forEach((choice, index) => {
          const anchor = anchors[index % Math.max(1, anchors.length)];
          const id = `choice_${choice.key}`;
          interactables.push({
            id,
            socket: anchor?.socket ?? socketFor("table"),
            label: choice.label,
            kind: anchor?.kind ?? "talk",
            choiceKey: choice.key,
          });
          choiceBindings[choice.key] = id;
        });
      } else {
        interactables.push({
          id: "continue",
          socket: "player_start",
          label: "Continue",
          kind: "look",
        });
      }

      const dialogue = decision
        ? [
            { speaker: facts.playerName, text: decision.question },
            ...(mother
              ? [{ speaker: mother.name, text: "What will you do?" }]
              : []),
          ]
        : [
            {
              speaker: facts.playerName,
              text: trigger.eventText ?? "Time passes.",
            },
          ];

      const plan: ScenePlan = {
        template: templateId,
        triggerKind: trigger.kind,
        title: decision?.question ?? trigger.eventText ?? template.name,
        summary:
          trigger.kind === "death"
            ? "A quiet room at the end of a life."
            : `A moment at age ${trigger.age}.`,
        timeOfDay: "morning",
        weather: "clear",
        cast,
        player: {
          socket: "player_start",
          age: run.state.age,
          cameraHeight: ageCameraHeight(run.state.age),
        },
        dialogue,
        interactables,
        choiceBindings,
        ambience: templateId,
      };

      const result = validateScenePlan(plan, {
        template,
        characterIds,
        choiceKeys,
        focusKeys: [],
        facts,
      });
      if (!result.ok) {
        throw new Error(`invalid_scene:${result.errors.join(",")}`);
      }
      return result.plan;
    },
  };
}
