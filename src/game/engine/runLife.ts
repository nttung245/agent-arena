import { uid } from "@/lib/storage";
import {
  MAX_SCENES,
  defaultChoiceKey,
  isMajorDecision,
  selectTrigger,
  type SceneTrigger,
} from "@/game/engine/chapters";
import { OneIn8bError, type LifeTransport } from "@/game/engine/oneIn8b";
import { selectTemplate, type SceneDirector } from "@/game/engine/director";
import type {
  LiveResponse,
  StartOptions,
  StepBody,
} from "@/game/engine/types";
import {
  applyLiveResponse,
  createRun,
  type LifeConfig,
  type LifeRun,
} from "@/game/state/lifeRun";
import { buildFactSheet, validateScenePlan } from "@/game/scenes/validate";
import type {
  LifeFactSheet,
  LifeTemplateId,
  SceneInteractable,
  ScenePlan,
  SceneTemplate,
} from "@/game/scenes/types";

export interface LifeDeps {
  transport: LifeTransport;
  director: SceneDirector;
  templates: Record<LifeTemplateId, SceneTemplate>;
  characterIds: ReadonlySet<string>;
}

export interface LifeNext {
  run: LifeRun;
  scene: ScenePlan | null;
  error?: OneIn8bError;
}

function asLifeError(error: unknown): OneIn8bError {
  if (error instanceof OneIn8bError) return error;
  if (error instanceof Error) {
    return new OneIn8bError(error.message, "unknown", 0);
  }
  return new OneIn8bError("Something went wrong", "unknown", 0);
}

function failedRun(config: LifeConfig): LifeRun {
  return {
    id: "failed",
    startedAt: Date.now(),
    engineVersion: "unknown",
    config,
    token: "",
    state: { age: 0 },
    decision: null,
    focus: null,
    sheet: [],
    journal: [],
    thoughts: {},
    chapterIndex: 0,
    sceneCount: 0,
    ended: false,
    death: null,
    phase: "setup",
    meta: null,
    usage: null,
  };
}

export function configToStart(config: LifeConfig): StartOptions {
  const sex =
    config.sex === "female" || config.sex === "male"
      ? config.sex
      : Math.random() < 0.5
        ? "female"
        : "male";

  const options: StartOptions = {
    country: "VNM",
    sex,
    policy: "auto",
    sensitive: 0,
    suicide: 0,
  };
  if (typeof config.year === "number") options.year = config.year;
  else if (config.future) options.future = true;
  if (config.fifth) options.fifth = config.fifth;
  if (config.place) options.place = config.place;
  if (config.faith) options.faith = config.faith;
  if (config.disability) options.disability = config.disability;
  if (typeof config.seed === "number") options.seed = config.seed;
  return options;
}

function withScene(run: LifeRun, scene: ScenePlan): LifeRun {
  const titles = run.sceneTitles ?? [];
  return {
    ...run,
    pendingScene: scene,
    sceneTitles: titles.includes(scene.title)
      ? titles
      : [...titles, scene.title],
  };
}

function fallbackPlan(
  deps: LifeDeps,
  run: LifeRun,
  trigger: SceneTrigger,
  facts: LifeFactSheet,
): ScenePlan | null {
  const templateId = selectTemplate(trigger, run);
  const template = deps.templates[templateId];
  if (!template) return null;

  const choices = trigger.decision?.choices ?? [];
  const anchors = template.interactables;
  const interactables: SceneInteractable[] = choices.map((choice, index) => {
    const anchor = anchors[index % Math.max(1, anchors.length)];
    return {
      id: `choice_${choice.key}`,
      socket: anchor?.socket ?? "player_start",
      label: choice.label,
      kind: anchor?.kind ?? "use",
      choiceKey: choice.key,
    };
  });
  if (interactables.length === 0) {
    interactables.push({
      id: "continue",
      socket: "player_start",
      label: "Continue",
      kind: "look",
    });
  }

  const plan: ScenePlan = {
    template: templateId,
    triggerKind: trigger.kind,
    title: (trigger.decision?.question ?? trigger.eventText ?? template.name).slice(
      0,
      80,
    ),
    summary: `A moment at age ${trigger.age}.`,
    timeOfDay: "morning",
    weather: "clear",
    cast: [],
    player: {
      socket: "player_start",
      age: run.state.age,
      cameraHeight: 1.2,
    },
    dialogue: [
      {
        speaker: facts.playerName,
        text:
          trigger.decision?.question ??
          trigger.eventText ??
          "Time passes.",
      },
    ],
    interactables,
    choiceBindings: Object.fromEntries(
      choices.map((choice) => [choice.key, `choice_${choice.key}`]),
    ),
    ambience: templateId,
  };

  const result = validateScenePlan(plan, {
    template,
    characterIds: deps.characterIds,
    choiceKeys: choices.map((choice) => choice.key),
    focusKeys: [],
    facts,
  });
  return result.ok ? result.plan : null;
}

async function stageScene(
  deps: LifeDeps,
  run: LifeRun,
  trigger: SceneTrigger,
): Promise<LifeNext> {
  const facts = buildFactSheet(run.state);
  try {
    const scene = await deps.director.direct({
      trigger,
      run,
      facts,
      templates: deps.templates,
      dressing: [],
    });
    return { run: withScene(run, scene), scene };
  } catch (error) {
    const fallback = fallbackPlan(deps, run, trigger, facts);
    if (fallback) return { run: withScene(run, fallback), scene: fallback };
    return { run, scene: null, error: asLifeError(error) };
  }
}

async function resolveMinorDecisions(
  deps: LifeDeps,
  run: LifeRun,
  response: LiveResponse,
): Promise<{ run: LifeRun; response: LiveResponse; error?: OneIn8bError }> {
  let currentRun = run;
  let currentResponse = response;

  while (
    currentResponse.decision &&
    (currentRun.sceneCount >= MAX_SCENES ||
      !isMajorDecision(currentResponse.decision))
  ) {
    const choice = defaultChoiceKey(currentResponse.decision);
    try {
      currentResponse = await deps.transport.step({
        token: currentRun.token,
        choose: choice,
      });
    } catch (error) {
      return { run: currentRun, response: currentResponse, error: asLifeError(error) };
    }
    currentRun = applyLiveResponse(currentRun, currentResponse);
  }

  return { run: currentRun, response: currentResponse };
}

function reflectedAges(run: LifeRun): Set<number> {
  return new Set(Object.keys(run.thoughts).map(Number));
}

async function continueAfterAction(
  deps: LifeDeps,
  run: LifeRun,
  previousAge: number,
  response: LiveResponse,
): Promise<LifeNext> {
  const resolved = await resolveMinorDecisions(deps, run, response);
  const next = resolved.run;
  if (resolved.error) {
    return { run: next, scene: null, error: resolved.error };
  }

  const trigger = selectTrigger({
    run: next,
    previousAge,
    response: resolved.response,
    sceneCount: next.sceneCount,
    reflectedAges: reflectedAges(next),
  });
  if (trigger) {
    return stageScene(
      deps,
      { ...next, sceneCount: next.sceneCount + 1 },
      trigger,
    );
  }
  if (resolved.response.ended) {
    return { run: next, scene: null };
  }
  return advanceFrom(deps, next, previousAge, reflectedAges(next));
}

async function advanceFrom(
  deps: LifeDeps,
  run: LifeRun,
  previousAge: number,
  reflected: ReadonlySet<number>,
): Promise<LifeNext> {
  let current = run;
  let previous = previousAge;

  for (let step = 0; step < 30; step += 1) {
    let response: LiveResponse;
    try {
      response = await deps.transport.step({
        token: current.token,
        until: "decision",
      });
    } catch (error) {
      return { run: current, scene: null, error: asLifeError(error) };
    }

    let next = applyLiveResponse(current, response);
    const resolved = await resolveMinorDecisions(deps, next, response);
    next = resolved.run;
    if (resolved.error) {
      return { run: next, scene: null, error: resolved.error };
    }
    response = resolved.response;

    const trigger = selectTrigger({
      run: next,
      previousAge: previous,
      response,
      sceneCount: next.sceneCount,
      reflectedAges: reflected,
    });
    if (trigger) {
      return stageScene(
        deps,
        { ...next, sceneCount: next.sceneCount + 1 },
        trigger,
      );
    }
    if (response.ended) {
      return { run: next, scene: null };
    }

    current = next;
    previous = next.state.age;
  }

  return { run: { ...current, phase: "summary" }, scene: null };
}

export async function startLife(
  deps: LifeDeps,
  config: LifeConfig,
): Promise<LifeNext> {
  try {
    const response = await deps.transport.start(configToStart(config));
    const run = createRun(config, response);
    const trigger = selectTrigger({
      run,
      previousAge: -1,
      response,
      sceneCount: run.sceneCount,
      reflectedAges: new Set(),
    });
    if (trigger) {
      return stageScene(
        deps,
        { ...run, sceneCount: run.sceneCount + 1 },
        trigger,
      );
    }
    return advanceFrom(deps, run, run.state.age, new Set());
  } catch (error) {
    return { run: failedRun(config), scene: null, error: asLifeError(error) };
  }
}

export async function advanceLife(
  deps: LifeDeps,
  run: LifeRun,
): Promise<LifeNext> {
  if (run.ended) return { run, scene: null };
  return advanceFrom(deps, run, run.state.age, reflectedAges(run));
}

export async function submitChoice(
  deps: LifeDeps,
  run: LifeRun,
  key: string,
): Promise<LifeNext> {
  try {
    const response = await deps.transport.step({
      token: run.token,
      choose: key,
    });
    const applied = applyLiveResponse(run, response);
    const withChoice: LifeRun = {
      ...applied,
      journal: [
        ...applied.journal,
        {
          id: uid("j"),
          age: run.state.age,
          year: run.state.year,
          text: `You chose: ${key}`,
          kind: "decision",
          choiceKey: key,
        },
      ],
    };
    return continueAfterAction(deps, withChoice, run.state.age, response);
  } catch (error) {
    return { run, scene: null, error: asLifeError(error) };
  }
}

async function act(
  deps: LifeDeps,
  run: LifeRun,
  body: StepBody,
): Promise<LifeNext> {
  try {
    const response = await deps.transport.step(body);
    const applied = applyLiveResponse(run, response);
    return continueAfterAction(deps, applied, run.state.age, response);
  } catch (error) {
    return { run, scene: null, error: asLifeError(error) };
  }
}

export function submitFocus(
  deps: LifeDeps,
  run: LifeRun,
  key: string,
): Promise<LifeNext> {
  return act(deps, run, { token: run.token, focus: key });
}

export function buyItems(
  deps: LifeDeps,
  run: LifeRun,
  ids: string[],
): Promise<LifeNext> {
  return act(deps, run, { token: run.token, buy: ids });
}

export async function resumeLife(
  deps: LifeDeps,
  run: LifeRun,
): Promise<LifeNext> {
  if (run.ended) return { run, scene: null };
  if (run.pendingScene) return { run, scene: run.pendingScene };
  try {
    const response = await deps.transport.step({
      token: run.token,
      view: true,
    });
    const applied = applyLiveResponse(run, response);
    return continueAfterAction(deps, applied, run.state.age, response);
  } catch (error) {
    return { run, scene: null, error: asLifeError(error) };
  }
}
