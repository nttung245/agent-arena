import { create } from "zustand";
import { ALL_CHARACTERS } from "@/lib/assets/characters";
import {
  OneIn8bError,
  createOneIn8bTransport,
  readLifeKey,
} from "@/game/engine/oneIn8b";
import { createDeterministicDirector } from "@/game/engine/director";
import {
  advanceLife,
  buyItems,
  resumeLife,
  startLife,
  submitChoice,
  submitFocus,
  type LifeDeps,
  type LifeNext,
} from "@/game/engine/runLife";
import {
  addThought,
  type LifeConfig,
  type LifePhase,
  type LifeRun,
} from "@/game/state/lifeRun";
import { clearRun, loadRun, saveRun } from "@/game/state/persistence";
import { SCENE_TEMPLATES } from "@/game/scenes/registry";
import type { ScenePlan } from "@/game/scenes/types";

export interface LifeStore {
  run: LifeRun | null;
  scene: ScenePlan | null;
  phase: LifePhase;
  error: OneIn8bError | null;
  busy: boolean;
  start: (config: LifeConfig) => Promise<void>;
  choose: (key: string) => Promise<void>;
  focus: (key: string) => Promise<void>;
  buy: (ids: string[]) => Promise<void>;
  continueScene: () => Promise<void>;
  reflect: (age: number, text: string) => void;
  resume: () => Promise<void>;
  reset: () => void;
}

let depsOverride: LifeDeps | null = null;

/** Test hook: replace the live transport/director with fakes. */
export function setLifeDeps(deps: LifeDeps | null): void {
  depsOverride = deps;
}

function buildDeps(): LifeDeps | null {
  if (depsOverride) return depsOverride;
  const key = readLifeKey();
  if (!key) return null;
  const characterIds = new Set(ALL_CHARACTERS.map((character) => character.id));
  return {
    transport: createOneIn8bTransport(key),
    director: createDeterministicDirector(characterIds),
    templates: SCENE_TEMPLATES,
    characterIds,
  };
}

function missingKey(): OneIn8bError {
  return new OneIn8bError("Paste a 1in8b API key to begin.", "key", 401);
}

export const useLifeStore = create<LifeStore>((set, get) => {
  const apply = (next: LifeNext) => {
    if (next.run?.token) saveRun(next.run);
    set({
      run: next.run,
      scene: next.scene,
      phase: next.run?.phase ?? "setup",
      error: next.error ?? null,
      busy: false,
    });
  };

  const runAction = async (
    action: (deps: LifeDeps, run: LifeRun) => Promise<LifeNext>,
  ) => {
    const run = get().run;
    if (!run) return;
    const deps = buildDeps();
    if (!deps) {
      set({ error: missingKey(), busy: false });
      return;
    }
    set({ busy: true, error: null });
    apply(await action(deps, run));
  };

  return {
    run: null,
    scene: null,
    phase: "setup",
    error: null,
    busy: false,

    async start(config) {
      const deps = buildDeps();
      if (!deps) {
        set({ error: missingKey(), busy: false });
        return;
      }
      set({ busy: true, error: null });
      const next = await startLife(deps, config);
      if (next.error && !next.run.token) {
        set({ busy: false, error: next.error });
        return;
      }
      apply(next);
    },

    async choose(key) {
      await runAction((deps, run) => submitChoice(deps, run, key));
    },

    async focus(key) {
      await runAction((deps, run) => submitFocus(deps, run, key));
    },

    async buy(ids) {
      await runAction((deps, run) => buyItems(deps, run, ids));
    },

    async continueScene() {
      await runAction((deps, run) => advanceLife(deps, run));
    },

    reflect(age, text) {
      const run = get().run;
      if (!run) return;
      const next = addThought(run, age, text);
      saveRun(next);
      set({ run: next });
    },

    async resume() {
      const saved = loadRun();
      if (!saved) return;
      if (saved.ended) {
        set({ run: saved, scene: null, phase: saved.phase });
        return;
      }
      const deps = buildDeps();
      if (!deps) {
        set({ run: saved, error: missingKey(), busy: false });
        return;
      }
      set({ run: saved, busy: true, error: null });
      apply(await resumeLife(deps, saved));
    },

    reset() {
      clearRun();
      set({
        run: null,
        scene: null,
        phase: "setup",
        error: null,
        busy: false,
      });
    },
  };
});
