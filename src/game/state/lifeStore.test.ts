import { afterEach, describe, expect, it } from "vitest";
import { createRun } from "@/game/state/lifeRun";
import { useLifeStore } from "@/game/state/lifeStore";
import { LIFE_LIVES_STORAGE, LIFE_RUN_STORAGE, saveRun } from "@/game/state/persistence";

afterEach(() => {
  useLifeStore.getState().reset();
  localStorage.clear();
});

describe("useLifeStore with the local engine", () => {
  it("starts a life with no key and no network", async () => {
    await useLifeStore.getState().start({ year: 1990, sex: "female", region: "south" });
    const { run, error } = useLifeStore.getState();
    expect(error).toBeNull();
    expect(run?.engineVersion).toMatch(/^arena-life@/);
    expect(run?.state.age).toBe(0);
    expect(run?.state.region).toBe("south");
    expect(localStorage.getItem(LIFE_RUN_STORAGE)).not.toBeNull();
  });

  it("lives on from the birth to the next stop", async () => {
    await useLifeStore.getState().start({ year: 2000 });
    await useLifeStore.getState().continueScene();
    const { run, error } = useLifeStore.getState();
    expect(error).toBeNull();
    expect(run!.state.age).toBeGreaterThan(0);
  });

  it("explains that a saved 1in8b life can't go on, and keeps it as an unfinished memorial", async () => {
    const legacy = createRun(
      { year: 1995 },
      {
        state: { age: 12, name: "Trần Văn An", year: 2007 },
        events: [[0, "Born."]],
        decision: null,
        token: "k8b-token",
        meta: { engine: "1in8b 0.9.52" },
      },
    );
    saveRun(legacy);
    await useLifeStore.getState().resume();
    expect(useLifeStore.getState().error?.code).toBe("legacy");
    useLifeStore.getState().keepLegacy();
    const lives = JSON.parse(localStorage.getItem(LIFE_LIVES_STORAGE) ?? "[]");
    expect(lives[0]).toMatchObject({ name: "Trần Văn An", unfinished: true, engineVersion: "1in8b 0.9.52" });
    expect(useLifeStore.getState().run).toBeNull();
    expect(localStorage.getItem(LIFE_RUN_STORAGE)).toBeNull();
  });
});
