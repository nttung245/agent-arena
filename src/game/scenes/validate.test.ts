import { describe, expect, it } from "vitest";
import { blankMap } from "@/lib/maps/schema";
import { buildFactSheet, validateScenePlan } from "@/game/scenes/validate";
import type { ScenePlan, SceneTemplate } from "@/game/scenes/types";

const template: SceneTemplate = {
  id: "home_childhood",
  name: "Home",
  map: blankMap({ id: "home_childhood", name: "Home" }),
  sockets: {
    player_start: { position: [0, 0, 2], rotationY: 0 },
    mother: { position: [-1, 0, 0], rotationY: 0 },
    table: { position: [1, 0, 0], rotationY: 0 },
  },
  bounds: { minX: -5, maxX: 5, minZ: -5, maxZ: 5 },
  interactables: [
    { id: "table", socket: "table", label: "Sit at the table", kind: "use" },
  ],
};

const facts = {
  playerName: "Lan",
  age: 6,
  people: [{ name: "Hoa", role: "mother", age: 30, alive: true }],
  children: [],
};

const valid: ScenePlan = {
  template: "home_childhood",
  title: "A small room",
  summary: "Your mother calls you to the table.",
  timeOfDay: "morning",
  weather: "clear",
  cast: [
    {
      role: "mother",
      name: "Hoa",
      age: 30,
      characterId: "generic-female",
      mood: "warm",
      socket: "mother",
      lines: ["Come and eat."],
    },
  ],
  player: { socket: "player_start", age: 6, cameraHeight: 1.1 },
  dialogue: [{ speaker: "Hoa", text: "Come and eat." }],
  interactables: [
    {
      id: "table",
      socket: "table",
      label: "Sit at the table",
      kind: "use",
      choiceKey: "eat",
    },
  ],
  choiceBindings: { eat: "table" },
  ambience: "home",
};

const ctx = (over: Partial<Parameters<typeof validateScenePlan>[1]> = {}) => ({
  template,
  characterIds: new Set(["generic-female"]),
  choiceKeys: ["eat"],
  focusKeys: [],
  facts,
  ...over,
});

describe("validateScenePlan", () => {
  it("accepts a complete plan", () => {
    expect(validateScenePlan(valid, ctx()).ok).toBe(true);
  });

  it("rejects a missing choice binding", () => {
    const bad = { ...valid, choiceBindings: {} };
    const result = validateScenePlan(bad, ctx());
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.errors).toContain("missing_choice:eat");
  });

  it("rejects an unknown character id", () => {
    const bad = {
      ...valid,
      cast: [{ ...valid.cast[0]!, characterId: "nope" }],
    };
    const result = validateScenePlan(bad, ctx());
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.errors[0]).toContain("unknown_character");
  });

  it("rejects an unknown socket", () => {
    const bad = { ...valid, player: { ...valid.player, socket: "nope" } };
    const result = validateScenePlan(bad, ctx());
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.errors[0]).toContain("unknown_socket");
  });

  it("rejects a dead person speaking in the present unless it is a memory", () => {
    const deadFacts = {
      ...facts,
      people: [{ name: "Hoa", role: "mother", age: 60, alive: false }],
    };
    const result = validateScenePlan(valid, ctx({ facts: deadFacts }));
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.errors[0]).toContain("dead_speaks");
    const memory = { ...valid, memory: true };
    expect(validateScenePlan(memory, ctx({ facts: deadFacts })).ok).toBe(true);
  });

  it("rejects an unknown person name", () => {
    const bad = {
      ...valid,
      cast: [{ ...valid.cast[0]!, name: "Stranger" }],
    };
    const result = validateScenePlan(bad, ctx());
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.errors[0]).toContain("unknown_person");
  });
});

describe("buildFactSheet", () => {
  it("collects the family defensively and skips unnamed people", () => {
    const sheet = buildFactSheet({
      age: 10,
      name: "Lan",
      mother: { name: "Hoa", age: 35, alive: true },
      father: { name: "Minh", age: 38, dead: true },
      siblings: [{ name: "An", age: 8 }],
      partner: { name: "Bao" },
      kids: [{ name: "Mai" }],
    });
    expect(sheet.playerName).toBe("Lan");
    expect(sheet.people.map((p) => p.name)).toEqual([
      "Hoa",
      "Minh",
      "An",
      "Bao",
      "Mai",
    ]);
    expect(sheet.people.find((p) => p.name === "Minh")?.alive).toBe(false);
    expect(sheet.children).toEqual(["Mai"]);
  });

  it("does not invent a name when the state is loose", () => {
    const sheet = buildFactSheet({ age: 0 });
    expect(sheet.people).toEqual([]);
    expect(sheet.playerName).toBe("You");
  });
});
